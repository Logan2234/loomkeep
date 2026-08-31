import type { DecadeBucketDto } from "@loomkeep/shared";

export class DecadeBucketResponseDto implements DecadeBucketDto {
  decade!: number;
  count!: number;
}
