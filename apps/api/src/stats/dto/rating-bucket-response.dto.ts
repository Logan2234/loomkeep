import type { RatingBucketDto } from "@loomkeep/shared";

export class RatingBucketResponseDto implements RatingBucketDto {
  rating!: number;
  count!: number;
}
