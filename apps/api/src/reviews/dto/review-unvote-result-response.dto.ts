import type { ReviewUnvoteResultDto } from "@loomkeep/shared";

export class ReviewUnvoteResultResponseDto implements ReviewUnvoteResultDto {
  score!: number;
}
