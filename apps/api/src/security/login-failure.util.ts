import type { AdminFailedLoginTargetDto } from "@loomkeep/shared";

/** How many identifiers the "most targeted" ranking carries. */
const TOP_TARGETS_LIMIT = 5;

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
