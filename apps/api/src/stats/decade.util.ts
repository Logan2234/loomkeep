import type { DecadeBucketDto } from "@tracklore/shared";

/** e.g. 1990 for a date in 1990-1999. */
export function decadeOf(date: Date): number {
  return Math.floor(date.getUTCFullYear() / 10) * 10;
}

/**
 * Buckets release dates into decades (e.g. 1990 for 1990-1999). Dates without
 * a release date (null) are excluded — a decade can't be inferred for them.
 * Returns only decades with at least one release, ascending.
 */
export function computeDecadeHistogram(
  releaseDates: (Date | null)[],
): DecadeBucketDto[] {
  const counts = new Map<number, number>();

  for (const date of releaseDates) {
    if (!date) continue;
    const decade = decadeOf(date);
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decade, count]) => ({ decade, count }));
}
