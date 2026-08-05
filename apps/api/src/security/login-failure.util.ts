import type { AdminFailedLoginTargetDto } from "@tracklore/shared";

/** How many identifiers the "most targeted" ranking carries. */
const TOP_TARGETS_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the trailing window of `days` days ending at `now`. */
export function sinceDaysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/**
 * Identifiers by failed-login count, most first. Ties break on the identifier so
 * the ranking doesn't reshuffle between two refreshes of the same data.
 */
export function rankFailedTargets(
  rows: { identifier: string; failures: number }[],
  limit = TOP_TARGETS_LIMIT,
): AdminFailedLoginTargetDto[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.failures - a.failures || a.identifier.localeCompare(b.identifier),
    )
    .slice(0, limit);
}
