import type { DecadeBucketDto, LabelCountDto } from "@loomkeep/shared";
import { decadeOf } from "../../stats/decade.util";

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

/** Most watch events falling within any rolling 24h window. */
export function computeLongestBinge(watchedAt: Date[]): number {
  const times = watchedAt.map((d) => d.getTime()).sort((a, b) => a - b);
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  let best = 0;
  let start = 0;

  for (let end = 0; end < times.length; end++) {
    while (times[end] - times[start] >= WINDOW_MS) start++;
    best = Math.max(best, end - start + 1);
  }

  return best;
}

/** Tallied labels as a ranked list, most frequent first. */
export function toRankedList(counts: Map<string, number>): LabelCountDto[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
