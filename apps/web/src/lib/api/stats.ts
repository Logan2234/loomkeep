import type {
  BookStatsDto,
  GameStatsDto,
  MusicStatsDto,
  SocialStatsDto,
  StatsDomain,
  StatsOverviewDto,
  StatsWindow,
  StatsWorkDto,
  VideoStatsDto,
  VideoTemporalDto,
  WatchStaleness,
} from "@loomkeep/shared";
import { request } from "./core";

export const getStatsOverview = (
  domain: StatsDomain | "ALL" = "ALL",
): Promise<StatsOverviewDto> =>
  request(`/stats/overview?${new URLSearchParams({ domain })}`);

export const getStatsWorksByRating = (
  domain: StatsDomain | "ALL",
  rating: number,
): Promise<StatsWorkDto[]> =>
  request(
    `/stats/works?${new URLSearchParams({ domain, rating: String(rating) })}`,
  );

export const getStatsWorksByDecade = (
  domain: StatsDomain | "ALL",
  decade: number,
): Promise<StatsWorkDto[]> =>
  request(
    `/stats/works?${new URLSearchParams({ domain, decade: String(decade) })}`,
  );

export const getVideoStats = (): Promise<VideoStatsDto> =>
  request("/stats/video");

export const getVideoSeries = (kind: WatchStaleness): Promise<StatsWorkDto[]> =>
  request(`/stats/video/series?${new URLSearchParams({ kind })}`);

export const getGameStats = (): Promise<GameStatsDto> =>
  request("/stats/games");

export const getBookStats = (): Promise<BookStatsDto> =>
  request("/stats/books");

export const getMusicStats = (): Promise<MusicStatsDto> =>
  request("/stats/music");

export const getVideoTemporal = (
  period: StatsWindow = "ALL",
): Promise<VideoTemporalDto> =>
  request(`/stats/video/temporal?${new URLSearchParams({ period })}`);

export const getSocialStats = (): Promise<SocialStatsDto> =>
  request("/stats/social");
