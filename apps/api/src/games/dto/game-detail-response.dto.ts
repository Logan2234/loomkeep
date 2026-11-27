import type {
  GameDetailDto,
  GameLanguageDto,
  GameStoreLinkDto,
  StoredGameDetailDto,
} from "@loomkeep/shared/contracts";
import { GAME_STORES } from "@loomkeep/shared/contracts";
import type { ReleaseDatePrecision } from "@loomkeep/shared/enums";
import { GameSource } from "@loomkeep/shared/enums";
import { ApiProperty } from "@nestjs/swagger";
import { CreatorRefResponseDto } from "../../catalog/dto/creator-ref-response.dto";
import { RatingResponseDto } from "../../catalog/dto/rating-response.dto";
import { GameEntryResponseDto } from "./game-entry-response.dto";
import { GameSummaryResponseDto } from "./game-summary-response.dto";
import { GameTimeToBeatResponseDto } from "./game-time-to-beat-response.dto";

class GameStoreLinkResponseDto implements GameStoreLinkDto {
  @ApiProperty({ enum: GAME_STORES })
  store!: GameStoreLinkDto["store"];

  url!: string;
}

class GameLanguageResponseDto implements GameLanguageDto {
  locale!: string;
  interface!: boolean;
  subtitles!: boolean;
  audio!: boolean;
}

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
  releaseDatePrecision!: ReleaseDatePrecision | null;
  upcoming!: boolean;
  website!: string | null;
  stores!: GameStoreLinkResponseDto[];
  languages!: GameLanguageResponseDto[];
  similarGames!: GameSummaryResponseDto[];
  developers!: string[];
  publishers!: string[];
  developerRefs!: CreatorRefResponseDto[];
  publisherRefs!: CreatorRefResponseDto[];
  gameModes!: string[];
  playerPerspectives!: string[];
  franchiseGames!: GameSummaryResponseDto[];
  franchiseName!: string | null;
  franchiseRefs!: CreatorRefResponseDto[];
  ratings!: RatingResponseDto[];
  storyline!: string | null;
  trailerVideoId!: string | null;
  ageRatingImageUrls!: string[];
  multiplayerModes!: string[];
  timeToBeat!: GameTimeToBeatResponseDto | null;
  commentTargetId!: string | null;
  entry!: GameEntryResponseDto | null;
}

export class StoredGameDetailResponseDto implements StoredGameDetailDto {
  detail!: GameDetailResponseDto | null;
}
