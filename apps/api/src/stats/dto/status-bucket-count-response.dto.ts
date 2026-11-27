import type {
  StatsStatusBucket,
  StatusBucketCountDto,
} from "@loomkeep/shared/contracts";

export class StatusBucketCountResponseDto implements StatusBucketCountDto {
  bucket!: StatsStatusBucket;
  count!: number;
}
