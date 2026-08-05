import type {
  AdminCohortRowDto,
  AdminEnabledDomainsBucketDto,
} from "@tracklore/shared";

/**
 * How many signup-month cohorts the retention table shows. Six is what the
 * table stays readable at (and matches the approved mockup) — older cohorts
 * only add rows whose columns are all long-tail noise.
 */
export const COHORT_MONTHS = 6;

/** Ascending UTC month starts, oldest first, the last one being `now`'s month. */
export function cohortMonthStarts(now: Date, count = COHORT_MONTHS): Date[] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return Array.from(
    { length: count },
    (_, i) => new Date(Date.UTC(y, m - (count - 1 - i), 1)),
  );
}

/** An account reduced to what retention needs: when it joined, when it was last seen. */
export interface CohortUser {
  createdAt: Date;
  /** Most recent `RefreshToken.lastUsedAt`, or null when the account never held a session. */
  lastActiveAt: Date | null;
}

/**
 * Monthly retention table: one row per signup month, one column per month
 * elapsed since.
 *
 * Retention is read as *survival*: a user counts as retained at month M when
 * their last session is at or after the start of M. We only keep the latest
 * use of each refresh token (`lastUsedAt` is bumped in place on rotation), so
 * per-month presence isn't recoverable — survival is the honest reading of the
 * data we have, and it keeps every row monotonically decreasing.
 */
export function cohortRetention(
  users: CohortUser[],
  monthStarts: Date[],
): AdminCohortRowDto[] {
  return monthStarts.map((start, row) => {
    const end =
      row + 1 < monthStarts.length
        ? monthStarts[row + 1].getTime()
        : Number.POSITIVE_INFINITY;
    const cohort = users.filter((u) => {
      const t = u.createdAt.getTime();
      return t >= start.getTime() && t < end;
    });

    // Columns run from the signup month to the current month only.
    const retention = monthStarts.slice(row).map((col) => {
      if (cohort.length === 0) return 0;
      const alive = cohort.filter(
        (u) => u.lastActiveAt !== null && u.lastActiveAt >= col,
      ).length;
      return Math.round((alive / cohort.length) * 100);
    });

    return { month: start.toISOString(), size: cohort.length, retention };
  });
}

/**
 * How many accounts enabled exactly N domains, descending by account count.
 * Buckets with no account are dropped — an empty row carries no information.
 */
export function enabledDomainCountBuckets(
  users: { enabledDomains: string[] }[],
): AdminEnabledDomainsBucketDto[] {
  const counts = new Map<number, number>();

  for (const u of users) {
    const n = u.enabledDomains.length;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([domains, accounts]) => ({ domains, accounts }))
    .sort((a, b) => b.accounts - a.accounts || b.domains - a.domains);
}
