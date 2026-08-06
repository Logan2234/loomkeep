import { Injectable } from "@nestjs/common";
import type { JobDto, JobRunDto } from "@loomkeep/shared";
import type { JobRun } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JOB_KEYS, JOB_REGISTRY, type JobKey } from "./job-keys";

/** Runs kept per job — bounds the table on a self-host instance running for years. */
const RUNS_KEPT_PER_JOB = 50;
/** Runs shown in the admin page per job. */
const RECENT_RUNS_SHOWN = 20;

@Injectable()
export class JobRunService {
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

    try {
      const result = await fn();
      await this.persist(jobKey, startedAt, "SUCCESS", summarize(result));
      return result;
    } catch (err) {
      await this.persist(
        jobKey,
        startedAt,
        "FAILURE",
        undefined,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
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
