import type { RatingBucketDto } from "@loomkeep/shared/contracts";

export class RatingBucketResponseDto implements RatingBucketDto {
  rating!: number;
  count!: number;
}
