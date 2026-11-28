import type {
  StatsStatusBucket,
  StatusBucketCountDto,
} from "@loomkeep/shared/contracts";

/** Counts already-bucketed statuses, omitting buckets with zero entries. */
export function countByBucket(
  buckets: StatsStatusBucket[],
): StatusBucketCountDto[] {
  const counts = new Map<StatsStatusBucket, number>();

  for (const bucket of buckets) {
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()].map(([bucket, count]) => ({ bucket, count }));
}
