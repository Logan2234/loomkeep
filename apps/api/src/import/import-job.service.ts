import type {
  ImportAnalyzeRequest,
  ImportAvailabilityDto,
  ImportCommitRequest,
  ImportJobDto,
  ImportPlan,
  ImportQuotaDto,
  ImportReport,
  ImportSource,
} from "@loomkeep/shared";
import { Domain } from "@loomkeep/shared";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { EntitlementService } from "../entitlements/entitlement.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  IMPORT_SOURCES,
  type CommitDecisions,
  type ImportReq,
  type ProgressReporter,
} from "./import-source";

/** Completed jobs are dropped from memory after this delay. */
const JOB_RETENTION_MS = 60 * 60 * 1000;

interface JobRecord {
  id: string;
  userId: string;
  sourceId: ImportSource;
  kind: "analyze" | "commit";
  status: "running" | "completed" | "failed";
  progress: { done: number; total: number };
  plan: ImportPlan | null;
  report: ImportReport | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  /** The source's parse model, kept between an analysis and its later commit. */
  parsed: unknown;
}

/**
 * The one async job engine behind every import. It owns the in-memory job
 * store, the analyze → poll → commit → poll lifecycle, progress and ownership
 * guards; each {@link ImportReq} plugs in its own parse/resolve/write. Jobs
 * live in memory (single-instance self-host) and are pruned an hour after they
 * finish.
 */
@Injectable()
export class ImportJobService {
  private readonly logger = new Logger(ImportJobService.name);
  private readonly jobs = new Map<string, JobRecord>();
  private readonly sources: Map<ImportSource, ImportReq>;

  constructor(
    @Inject(IMPORT_SOURCES) sources: ImportReq[],
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementService,
  ) {
    this.sources = new Map(sources.map((s) => [s.id, s]));
  }

  /**
   * Which sources depending on their own optional server config
   * ({@link ImportReq.requiredEnvKeys}) are actually usable right now — a
   * source with none of its own is simply absent from the map (always
   * available). Cheap enough to compute on every call; nothing here changes
   * without a server restart.
   */
  getAvailability(): ImportAvailabilityDto {
    const availability: ImportAvailabilityDto = {};

    for (const source of this.sources.values()) {
      if (!source.requiredEnvKeys) continue;
      availability[source.id] = source.requiredEnvKeys.every((key) =>
        Boolean(this.config.get<string>(key)),
      );
    }

    return availability;
  }

  /**
   * Per `Domain`, whether this user has already used their one free import
   * in it — see {@link assertImportAllowed}. Domains never successfully
   * imported into are simply absent from the map.
   */
  async getQuota(userId: string): Promise<ImportQuotaDto> {
    const runs = await this.prisma.importRun.findMany({
      where: {
        userId,
        status: "SUCCESS",
        itemCount: { gt: 0 },
        domain: { not: null },
      },
      select: { domain: true },
      distinct: ["domain"],
    });

    const quota: ImportQuotaDto = {};

    for (const run of runs) {
      if (run.domain) quota[run.domain as Domain] = true;
    }

    return quota;
  }

  /**
   * Parse the export and, in the background, resolve it into a review
   * {@link ImportPlan} — writing nothing. Returns a pending job to poll.
   */
  async startAnalyze(
    userId: string,
    sourceId: ImportSource,
    dto: ImportAnalyzeRequest,
  ): Promise<ImportJobDto> {
    this.pruneOldJobs();
    const source = this.sourceOrThrow(sourceId);
    await this.assertImportAllowed(userId, source.searchDomain);

    let parsed: unknown;

    try {
      parsed = source.parseInput(dto.input);
    } catch (error) {
      // A malformed export is a client error, not a failed job.
      throw new BadRequestException(
        error instanceof Error ? error.message : "Could not read the export",
      );
    }

    const job = this.newJob(userId, sourceId, "analyze", parsed);
    this.jobs.set(job.id, job);

    const progress = this.progressFor(job);
    void this.run(job, async () => {
      job.plan = await source.buildPlan(userId, parsed, progress);
    });

    return toDto(job);
  }

  /** Commit a previously analysed import with the user's decisions. */
  commit(
    userId: string,
    sourceId: ImportSource,
    jobId: string,
    dto: ImportCommitRequest,
  ): ImportJobDto {
    this.pruneOldJobs();
    const source = this.sourceOrThrow(sourceId);

    const analyzed = this.jobs.get(jobId);
    if (!analyzed) throw new NotFoundException("Import job not found");

    if (analyzed.userId !== userId) {
      throw new ForbiddenException("This import job belongs to another user");
    }

    if (analyzed.sourceId !== sourceId) {
      throw new BadRequestException("Import job source mismatch");
    }

    if (
      analyzed.parsed === null ||
      analyzed.parsed === undefined ||
      !analyzed.plan
    ) {
      throw new BadRequestException("This job has no analysis to commit");
    }

    const decisions: CommitDecisions = {
      include: new Set(dto.include),
      statuses: new Map(Object.entries(dto.statuses ?? {})),
      overrides: new Map(Object.entries(dto.overrides ?? {})),
      overwrite: (dto.overwrite ?? false) && source.supportsOverwrite,
    };

    const { parsed, plan } = analyzed;
    const job = this.newJob(userId, sourceId, "commit", null);
    job.progress.total = decisions.include.size;
    this.jobs.set(job.id, job);

    const progress = this.progressFor(job);
    void this.run(job, async () => {
      job.report = await source.commit(
        userId,
        parsed,
        plan,
        decisions,
        progress,
      );
    }).then(() =>
      this.recordRun(userId, job, decisions.overwrite).catch((err) => {
        // Audit logging must never take the request path down with it.
        this.logger.error(`Failed to record import run ${job.id}`, err);
      }),
    );

    return toDto(job);
  }

  getJob(userId: string, jobId: string): ImportJobDto {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException("Import job not found");

    if (job.userId !== userId) {
      throw new ForbiddenException("This import job belongs to another user");
    }

    return toDto(job);
  }

  private sourceOrThrow(sourceId: ImportSource): ImportReq {
    const source = this.sources.get(sourceId);
    if (!source)
      throw new NotFoundException(`Unknown import source: ${sourceId}`);
    return source;
  }

  /**
   * A free account gets one successful import per `Domain`, regardless of
   * source (TV Time then Trakt on MEDIA counts as a 2nd MEDIA import) — see
   * docs/adr/0001-open-core-agpl.md. No-op while the `premium-features` flag
   * is off (see `EntitlementService#isEffectivelyPremium`) or once premium.
   */
  private async assertImportAllowed(
    userId: string,
    domain: Domain,
  ): Promise<void> {
    if (await this.entitlements.isEffectivelyPremium(userId)) return;

    const alreadyImported = await this.prisma.importRun.findFirst({
      where: { userId, domain, status: "SUCCESS", itemCount: { gt: 0 } },
      select: { id: true },
    });

    if (alreadyImported) {
      throw new ForbiddenException(
        "Un import gratuit par domaine — passe premium pour réimporter dans ce domaine.",
      );
    }
  }

  private newJob(
    userId: string,
    sourceId: ImportSource,
    kind: "analyze" | "commit",
    parsed: unknown,
  ): JobRecord {
    return {
      id: randomUUID(),
      userId,
      sourceId,
      kind,
      status: "running",
      progress: { done: 0, total: 0 },
      plan: null,
      report: null,
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
      parsed,
    };
  }

  /** Logs a finished commit to the admin "Imports" audit log (analyze runs write nothing). */
  private async recordRun(
    userId: string,
    job: JobRecord,
    overwrite: boolean,
  ): Promise<void> {
    await this.prisma.importRun.create({
      data: {
        userId,
        sourceId: job.sourceId,
        domain: this.sourceOrThrow(job.sourceId).searchDomain,
        status: job.status === "failed" ? "FAILURE" : "SUCCESS",
        itemCount: job.progress.total,
        overwrite,
        summary: job.report
          ? job.report.tiles.map((t) => `${t.value} ${t.label}`).join(" · ")
          : null,
        error: job.error,
        startedAt: new Date(job.startedAt),
        finishedAt: new Date(job.finishedAt ?? Date.now()),
      },
    });
  }

  private progressFor(job: JobRecord): ProgressReporter {
    return {
      setTotal: (total) => {
        job.progress.total = total;
      },
      tick: () => {
        job.progress.done++;
      },
    };
  }

  /** Run the background work, flipping the job to completed/failed when done. */
  private async run(job: JobRecord, work: () => Promise<void>): Promise<void> {
    try {
      await work();
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      job.finishedAt = Date.now();
    }
  }

  private pruneOldJobs(): void {
    const cutoff = Date.now() - JOB_RETENTION_MS;

    for (const [id, job] of this.jobs) {
      if (job.finishedAt !== null && job.finishedAt < cutoff) {
        this.jobs.delete(id);
      }
    }
  }
}

function toDto(job: JobRecord): ImportJobDto {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    plan: job.plan,
    report: job.report,
    error: job.error,
  };
}
