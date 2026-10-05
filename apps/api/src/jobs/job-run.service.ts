import type { JobDto, JobRunDto } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { JobRun } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { HTTP_TIMEOUT_MS } from "../common/http.util";
import { PrismaService } from "../prisma/prisma.service";
import { JobAlertService } from "./job-alert.service";
import { JOB_HEALTHCHECK_ENV, JOB_KEYS, type JobKey } from "./job-keys";

/** Runs kept per job — bounds the table on a self-host instance running for years. */
const RUNS_KEPT_PER_JOB = 50;

@Injectable()
export class JobRunService {
  private readonly logger = new Logger(JobRunService.name);
  private readonly startedAt = new Date();
  private readonly running = new Map<JobKey, Set<Date>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: JobAlertService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /**
   * Runs `fn`, records the outcome (success/failure + a summary), prunes old
   * runs for this job, then returns `fn`'s result (or rethrows its error).
   * The admins are alerted when the outcome differs from the previous run's.
   */
  async record<T>(
    jobKey: JobKey,
    fn: () => Promise<T>,
    summarize: (result: T) => string,
  ): Promise<T> {
    const startedAt = new Date();
    const active = this.running.get(jobKey) ?? new Set<Date>();
    active.add(startedAt);
    this.running.set(jobKey, active);
    // Short correlation id, generated once per run: the only way to tie a
    // FAILURE row on the admin "Jobs" page back to that run's actual log
    // lines (JobRun.error has no room for a full log excerpt, only the
    // exception itself).
    const runId = randomUUID().split("-")[0];

    try {
      const result = await fn();
      const previous = await this.lastStatus(jobKey);
      await this.persist(jobKey, startedAt, "SUCCESS", summarize(result));
      await this.ping(jobKey, true);
      if (previous === "FAILURE") await this.alerts.jobRecovered(jobKey);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`[${runId}] Job ${jobKey} failed`, error.stack);
      const previous = await this.lastStatus(jobKey);
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
      if (previous !== "FAILURE") await this.alerts.jobFailed(jobKey, error);
      throw err;
    } finally {
      active.delete(startedAt);
      if (active.size === 0) this.running.delete(jobKey);
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
      await fetch(success ? url : `${url}/fail`, {
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
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
          take: RUNS_KEPT_PER_JOB,
        }),
      ),
    );

    return keys.map((key, i) => ({
      key,
      runs: runsByKey[i].map(toRunDto),
      ...this.scheduleState(key, runsByKey[i][0]?.startedAt),
    }));
  }

  private scheduleState(key: JobKey, lastStartedAt?: Date) {
    const active = this.running.get(key);
    const runningSince = active?.size
      ? new Date(
          Math.min(...Array.from(active, (date) => date.getTime())),
        ).toISOString()
      : null;
    const cron = this.scheduler.getCronJobs().get(key);
    if (!cron)
      return {
        runningSince,
        timeZone: null,
        nextRunAt: null,
        overdueSince: null,
      };
    const next = cron.nextDate();
    const timeZone = cron.cronTime.timeZone ?? next.zoneName;
    const expected = cron.cronTime.getNextDateFrom(
      lastStartedAt ?? this.startedAt,
      timeZone ?? undefined,
    );
    // Allow the scheduled callback to enter record() before flagging a missed run.
    const overdueSince =
      !runningSince && expected.toMillis() < Date.now() - 60_000
        ? expected.toUTC().toISO()
        : null;
    return {
      runningSince,
      timeZone,
      nextRunAt: next.toUTC().toISO(),
      overdueSince,
    };
  }

  private async lastStatus(jobKey: JobKey): Promise<string | undefined> {
    const last = await this.prisma.jobRun.findFirst({
      where: { jobKey },
      orderBy: { startedAt: "desc" },
      select: { status: true },
    });
    return last?.status;
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
