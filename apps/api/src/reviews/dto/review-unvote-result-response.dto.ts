import type { ReviewUnvoteResultDto } from "@loomkeep/shared/contracts";

export class ReviewUnvoteResultResponseDto implements ReviewUnvoteResultDto {
  score!: number;
}
