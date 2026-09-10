import type { JobDto, JobRunDto } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import type { JobRun } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  JOB_HEALTHCHECK_ENV,
  JOB_KEYS,
  JOB_REGISTRY,
  type JobKey,
} from "./job-keys";

/** Runs kept per job — bounds the table on a self-host instance running for years. */
const RUNS_KEPT_PER_JOB = 50;
/** Runs shown in the admin page per job. */
const RECENT_RUNS_SHOWN = 20;

@Injectable()
export class JobRunService {
  private readonly logger = new Logger(JobRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs `fn`, records the outcome (success/failure + a summary), prunes old
   * runs for this job, then returns `fn`'s result (or rethrows its error).
   */
  async record<T>(
    jobKey: JobKey,
    fn: () => Promise<T>,
    summarize: (result: T) => string,
  ): Promise<T> {
    const startedAt = new Date();
    // Short correlation id, generated once per run: the only way to tie a
    // FAILURE row on the admin "Jobs" page back to that run's actual log
    // lines (JobRun.error has no room for a full log excerpt, only the
    // exception itself).
    const runId = randomUUID().split("-")[0];

    try {
      const result = await fn();
      await this.persist(jobKey, startedAt, "SUCCESS", summarize(result));
      await this.ping(jobKey, true);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`[${runId}] Job ${jobKey} failed`, error.stack);
      await this.persist(
        jobKey,
        startedAt,
        "FAILURE",
        undefined,
        // The run id heads the string (ties back to the log line above), and
        // the stack's own first line (the error message) stays first so the
        // admin page can show a one-line summary without parsing the rest.
        `[${runId}] ${error.stack ?? error.message}`,
      );
      await this.ping(jobKey, false);
      throw err;
    }
  }

  /**
   * Healthchecks.io dead-man's-switch ping: unlike the JobRun row above
   * (only ever written when the job actually runs), Healthchecks.io itself
   * notices when a job *stops* pinging on schedule — a crashed scheduler or
   * a hung job neither of us would otherwise catch. Best-effort: a
   * monitoring hiccup must never affect the job's own outcome.
   */
  private async ping(jobKey: JobKey, success: boolean): Promise<void> {
    const url = process.env[JOB_HEALTHCHECK_ENV[jobKey]];
    if (!url) return;

    try {
      await fetch(success ? url : `${url}/fail`);
    } catch {
      // Ignored — see doc comment above.
    }
  }

  async listJobs(): Promise<JobDto[]> {
    const keys = Object.values(JOB_KEYS);
    const runsByKey = await Promise.all(
      keys.map((key) =>
        this.prisma.jobRun.findMany({
          where: { jobKey: key },
          orderBy: { startedAt: "desc" },
          take: RECENT_RUNS_SHOWN,
        }),
      ),
    );

    return keys.map((key, i) => ({
      key,
      label: JOB_REGISTRY[key].label,
      schedule: JOB_REGISTRY[key].schedule,
      runs: runsByKey[i].map(toRunDto),
    }));
  }

  private async persist(
    jobKey: JobKey,
    startedAt: Date,
    status: "SUCCESS" | "FAILURE",
    summary?: string,
    error?: string,
  ): Promise<void> {
    await this.prisma.jobRun.create({
      data: {
        jobKey,
        startedAt,
        finishedAt: new Date(),
        status,
        summary,
        error,
      },
    });
    await this.prune(jobKey);
  }

  /** Deletes every run for this job beyond the {@link RUNS_KEPT_PER_JOB} most recent. */
  private async prune(jobKey: JobKey): Promise<void> {
    const stale = await this.prisma.jobRun.findMany({
      where: { jobKey },
      orderBy: { startedAt: "desc" },
      skip: RUNS_KEPT_PER_JOB,
      select: { id: true },
    });

    if (stale.length > 0) {
      await this.prisma.jobRun.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
    }
  }
}

function toRunDto(r: JobRun): JobRunDto {
  return {
    id: r.id,
    jobKey: r.jobKey,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt.toISOString(),
    status: r.status as JobRunDto["status"],
    summary: r.summary,
    error: r.error,
  };
}
