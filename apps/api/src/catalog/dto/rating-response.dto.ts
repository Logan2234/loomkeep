import type { RatingDto } from "@loomkeep/shared";

export class RatingResponseDto implements RatingDto {
  source!: string;
  score!: string;
  url?: string;
}
