import type { AdminTopContributorDto } from "@tracklore/shared";

/** How many writers the "Top contributeurs" ranking carries. */
const TOP_CONTRIBUTORS_LIMIT = 5;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Median time to close a report, in hours (one decimal). The median rather
 * than the mean: a single report forgotten for three weeks shouldn't make the
 * queue look neglected when everything else is handled the same day.
 */
export function medianResolutionHours(
  closed: { createdAt: Date; resolvedAt: Date }[],
): number | null {
  if (closed.length === 0) return null;

  const durations = closed
    .map((r) => r.resolvedAt.getTime() - r.createdAt.getTime())
    .sort((a, b) => a - b);

  const mid = Math.floor(durations.length / 2);
  const ms =
    durations.length % 2 === 1
      ? durations[mid]
      : (durations[mid - 1] + durations[mid]) / 2;

  return Math.round((ms / HOUR_MS) * 10) / 10;
}

/**
 * Share (0-100) of closed reports that were acted on. Pending reports carry no
 * verdict, so they are excluded from the denominator entirely — counting them
 * as "unfounded" would make a busy queue look like a wave of false reports.
 */
export function foundedPercent(
  resolved: number,
  dismissed: number,
): number | null {
  const closed = resolved + dismissed;
  return closed === 0 ? null : Math.round((resolved / closed) * 100);
}

/** One account's writing volume, as counted separately on each table. */
export interface ContributionCounts {
  /** userId → count. */
  reviews: Map<string, number>;
  /** userId → count (tombstones already excluded by the caller). */
  comments: Map<string, number>;
}

/** Every account that ever wrote a review or a standing comment. */
export function contributorIds(counts: ContributionCounts): Set<string> {
  return new Set([...counts.reviews.keys(), ...counts.comments.keys()]);
}

/**
 * Reviews + comments per account, descending. `usernames` resolves the ids the
 * caller looked up; an id with no username (deleted mid-refresh) is dropped
 * rather than shown as an anonymous row.
 */
export function rankContributors(
  counts: ContributionCounts,
  usernames: Map<string, string>,
  limit = TOP_CONTRIBUTORS_LIMIT,
): AdminTopContributorDto[] {
  const totals = new Map<string, number>();

  for (const [id, n] of counts.reviews)
    totals.set(id, (totals.get(id) ?? 0) + n);
  for (const [id, n] of counts.comments)
    totals.set(id, (totals.get(id) ?? 0) + n);

  return [...totals.entries()]
    .flatMap(([id, contributions]) => {
      const username = usernames.get(id);
      return username ? [{ username, contributions }] : [];
    })
    .sort(
      (a, b) =>
        b.contributions - a.contributions ||
        a.username.localeCompare(b.username),
    )
    .slice(0, limit);
}
