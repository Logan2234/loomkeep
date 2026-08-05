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
} from "@tracklore/shared";
import { request } from "./core";

export function getStatsOverview(
  domain: StatsDomain | "ALL" = "ALL",
): Promise<StatsOverviewDto> {
  return request(`/stats/overview?${new URLSearchParams({ domain })}`);
}

export function getStatsWorksByRating(
  domain: StatsDomain | "ALL",
  rating: number,
): Promise<StatsWorkDto[]> {
  return request(
    `/stats/works?${new URLSearchParams({ domain, rating: String(rating) })}`,
  );
}

export function getStatsWorksByDecade(
  domain: StatsDomain | "ALL",
  decade: number,
): Promise<StatsWorkDto[]> {
  return request(
    `/stats/works?${new URLSearchParams({ domain, decade: String(decade) })}`,
  );
}

export function getVideoStats(): Promise<VideoStatsDto> {
  return request("/stats/video");
}

export function getVideoSeries(kind: WatchStaleness): Promise<StatsWorkDto[]> {
  return request(`/stats/video/series?${new URLSearchParams({ kind })}`);
}

export function getGameStats(): Promise<GameStatsDto> {
  return request("/stats/games");
}

export function getBookStats(): Promise<BookStatsDto> {
  return request("/stats/books");
}

export function getMusicStats(): Promise<MusicStatsDto> {
  return request("/stats/music");
}

export function getVideoTemporal(
  period: StatsWindow = "ALL",
): Promise<VideoTemporalDto> {
  return request(`/stats/video/temporal?${new URLSearchParams({ period })}`);
}

export function getSocialStats(): Promise<SocialStatsDto> {
  return request("/stats/social");
}
