import type {
  HomeScreenWidgetAddedDto,
  HomeScreenWidgetFeedDto,
  HomeScreenWidgetGainDto,
  HomeScreenWidgetProgressionDto,
  HomeScreenWidgetReleaseDto,
  HomeScreenWidgetSessionDto,
  HomeScreenWidgetShowDto,
  HomeScreenWidgetTimerDto,
  HomeScreenWidgetTokenDto,
  SessionDomain,
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

export class HomeScreenWidgetTimerResponseDto implements HomeScreenWidgetTimerDto {
  domain!: SessionDomain;
  entryId!: string;
  title!: string;
  posterUrl!: string | null;
  path!: string;
  elapsedSeconds!: number;
  paused!: boolean;
}

export class HomeScreenWidgetSessionResponseDto implements HomeScreenWidgetSessionDto {
  domain!: SessionDomain;
  entryId!: string;
  title!: string;
  posterUrl!: string | null;
  path!: string;
  durationMinutes!: number;
  occurredAt!: string;
}

export class HomeScreenWidgetGainResponseDto implements HomeScreenWidgetGainDto {
  amount!: number;
  title!: string | null;
  at!: string;
}

export class HomeScreenWidgetProgressionResponseDto implements HomeScreenWidgetProgressionDto {
  xp!: number;
  level!: number;
  xpInLevel!: number;
  xpToNext!: number;
  streakDays!: number;
  streakSecuredToday!: boolean;
  today!: string;
  activeDays!: string[];
  gains!: HomeScreenWidgetGainResponseDto[];
}

export class HomeScreenWidgetAddedResponseDto implements HomeScreenWidgetAddedDto {
  kind!: "SERIES" | "MOVIE" | "ANIME" | "GAME" | "BOOK" | "ALBUM";
  title!: string;
  posterUrl!: string | null;
  path!: string;
  addedAt!: string;
}

export class HomeScreenWidgetFeedResponseDto implements HomeScreenWidgetFeedDto {
  toWatch!: HomeScreenWidgetShowResponseDto[];
  releases!: HomeScreenWidgetReleaseResponseDto[];
  timer!: HomeScreenWidgetTimerResponseDto | null;
  sessions!: HomeScreenWidgetSessionResponseDto[];
  weekMinutes!: number;
  progression!: HomeScreenWidgetProgressionResponseDto | null;
  added!: HomeScreenWidgetAddedResponseDto[];
}
