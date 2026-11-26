import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { JobKey } from "./job-keys";

/**
 * First half of every job lock's key (`pg_try_advisory_xact_lock(int, int)`),
 * so Loomkeep's locks can't collide with another application's on a shared
 * database. "LK" in ASCII.
 */
const LOCK_NAMESPACE = 0x4c4b;

/**
 * How long a run may hold its lock. Longer than any job takes (the slowest,
 * a catalogue refresh, runs in minutes) and shorter than the shortest cron
 * interval (6 hours), so a hung run can't keep the job from ever running again.
 */
const MAX_RUN_MS = 5 * 60 * 60 * 1000;

export type LockedRun<T> = { ran: true; value: T } | { ran: false };

/**
 * Makes a scheduled job run once across every API process sharing the
 * database. Loomkeep is built to run one API process per instance (see
 * docs/adr/0002-one-api-process.md), but nothing stops a self-hoster from
 * scaling the container: without this, each replica's @Cron would fire the
 * same job at the same moment and send its emails and digests twice.
 *
 * The lock is a transaction-scoped advisory lock: Postgres drops it when the
 * transaction ends, including when the process holding it dies, so a crash
 * never leaves a job locked out. The transaction does nothing else — the job
 * itself writes through the normal client — so it holds one pooled
 * connection, idle, for the length of the run.
 */
@Injectable()
export class JobLockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Runs `fn` if no other process is running `jobKey`, else returns `{ ran: false }` at once. */
  async runExclusive<T>(
    jobKey: JobKey,
    fn: () => Promise<T>,
  ): Promise<LockedRun<T>> {
    return this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${LOCK_NAMESPACE}::int, hashtext(${jobKey})) AS locked
        `;
        if (!locked) return { ran: false };
        return { ran: true, value: await fn() };
      },
      { timeout: MAX_RUN_MS },
    );
  }
}
