import type {
  HomeScreenWidgetFeedDto,
  HomeScreenWidgetReleaseDto,
  HomeScreenWidgetShowDto,
  HomeScreenWidgetTokenDto,
} from "@loomkeep/shared";
import { NextEpisodeResponseDto } from "../../library/dto/next-episode-response.dto";

export class HomeScreenWidgetTokenResponseDto implements HomeScreenWidgetTokenDto {
  token!: string;
}

export class HomeScreenWidgetShowResponseDto implements HomeScreenWidgetShowDto {
  entryId!: string;
  title!: string;
  posterUrl!: string | null;
  path!: string;
  next!: NextEpisodeResponseDto;
  watchedEpisodes!: number;
  totalEpisodes!: number;
}

export class HomeScreenWidgetReleaseResponseDto implements HomeScreenWidgetReleaseDto {
  kind!: "EPISODE" | "MOVIE" | "GAME";
  title!: string;
  posterUrl!: string | null;
  path!: string;
  seasonNumber!: number | null;
  episodeNumber!: number | null;
  airDate!: string;
  releasePrecision?: "DAY" | "MONTH";
}

export class HomeScreenWidgetFeedResponseDto implements HomeScreenWidgetFeedDto {
  toWatch!: HomeScreenWidgetShowResponseDto[];
  releases!: HomeScreenWidgetReleaseResponseDto[];
}
