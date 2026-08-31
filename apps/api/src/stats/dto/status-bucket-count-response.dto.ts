import type { StatsStatusBucket, StatusBucketCountDto } from "@loomkeep/shared";

export class StatusBucketCountResponseDto implements StatusBucketCountDto {
  bucket!: StatsStatusBucket;
  count!: number;
}
