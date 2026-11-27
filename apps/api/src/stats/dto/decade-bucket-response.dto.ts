import type { DecadeBucketDto } from "@loomkeep/shared/contracts";

export class DecadeBucketResponseDto implements DecadeBucketDto {
  decade!: number;
  count!: number;
}
