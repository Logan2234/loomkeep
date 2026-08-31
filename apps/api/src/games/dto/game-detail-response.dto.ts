import type { GameDetailDto } from "@loomkeep/shared";
import { GameSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { RatingResponseDto } from "../../catalog/dto/rating-response.dto";
import { GameEntryResponseDto } from "./game-entry-response.dto";
import { GameSummaryResponseDto } from "./game-summary-response.dto";

export class GameDetailResponseDto implements GameDetailDto {
  // See game-summary-response.dto.ts: single-member enum, needs an explicit hint.
  @ApiProperty({ enum: GameSource })
  source!: GameSource;

  sourceId!: string;
  title!: string;
  year!: number | null;
  coverUrl!: string | null;
  isAdult!: boolean;
  overview!: string | null;
  backdropUrl!: string | null;
  screenshots!: string[];
  genres!: string[];
  platforms!: string[];
  releaseDate!: string | null;
  website!: string | null;
  similarGames!: GameSummaryResponseDto[];
  developers!: string[];
  publishers!: string[];
  gameModes!: string[];
  playerPerspectives!: string[];
  franchiseGames!: GameSummaryResponseDto[];
  franchiseName!: string | null;
  ratings!: RatingResponseDto[];
  storyline!: string | null;
  trailerVideoId!: string | null;
  ageRatingImageUrls!: string[];
  multiplayerModes!: string[];
  entry!: GameEntryResponseDto | null;
}
