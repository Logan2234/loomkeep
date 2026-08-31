import type { GameStatsDto, GameTopEntryDto } from "@loomkeep/shared";
import { LabelCountResponseDto } from "../../common/dto/label-count-response.dto";

class GameTopEntryResponseDto implements GameTopEntryDto {
  title!: string;
  minutes!: number;
  href!: string;
}

class RatingByGroupResponseDto {
  label!: string;
  averageRating!: number;
  count!: number;
}

export class GameStatsResponseDto implements GameStatsDto {
  totalPlaytimeMinutes!: number;
  avgPlaytimePerCompletedMinutes!: number | null;
  neverLaunchedCount!: number;
  replaysCount!: number;
  topGamesByPlaytime!: GameTopEntryResponseDto[];
  topPlatforms!: LabelCountResponseDto[];
  topGenres!: LabelCountResponseDto[];
  avgRatingByPlatform!: RatingByGroupResponseDto[];
  avgRatingByGenre!: RatingByGroupResponseDto[];
}
