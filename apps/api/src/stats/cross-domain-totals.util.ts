import type {
  DomainStatusBreakdownDto,
  StatsStatusBucket,
  StatusBucketCountDto,
} from "@loomkeep/shared";

/**
 * Sums per-domain breakdowns into one "Tous domaines" total — the shared
 * status vocabulary (see status-bucket.util) is what makes this a plain sum
 * rather than a re-aggregation from raw entries.
 */
export function sumStatusBreakdowns(breakdowns: DomainStatusBreakdownDto[]): {
  total: number;
  favorites: number;
  byStatus: StatusBucketCountDto[];
} {
  let total = 0;
  let favorites = 0;
  const byBucket = new Map<StatsStatusBucket, number>();

  for (const d of breakdowns) {
    total += d.total;
    favorites += d.favorites;

    for (const { bucket, count } of d.byStatus) {
      byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + count);
    }
  }

  return {
    total,
    favorites,
    byStatus: [...byBucket.entries()].map(([bucket, count]) => ({
      bucket,
      count,
    })),
  };
}
