import type { RatingDto } from "@loomkeep/shared/contracts";

export class RatingResponseDto implements RatingDto {
  source!: string;
  score!: string;
  url?: string;
}
