import type {
  StatsDomain,
  StatsWindow,
  WatchStaleness,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const getStatsOverview = (domain: StatsDomain | "ALL" = "ALL") =>
  typedRequest("/stats/overview", { query: { domain } });

export const getStatsWorksByRating = (
  domain: StatsDomain | "ALL",
  rating: number,
) =>
  typedRequest("/stats/works", {
    query: { domain, rating: String(rating) },
  });

export const getStatsWorksByDecade = (
  domain: StatsDomain | "ALL",
  decade: number,
) =>
  typedRequest("/stats/works", {
    query: { domain, decade: String(decade) },
  });

export const getVideoStats = () => typedRequest("/stats/video");

export const getVideoSeries = (kind: WatchStaleness) =>
  typedRequest("/stats/video/series", { query: { kind } });

export const getGameStats = () => typedRequest("/stats/games");

export const getBookStats = () => typedRequest("/stats/books");

export const getMusicStats = () => typedRequest("/stats/music");

export const getVideoTemporal = (period: StatsWindow = "ALL") =>
  typedRequest("/stats/video/temporal", { query: { period } });

export const getSocialStats = () => typedRequest("/stats/social");
