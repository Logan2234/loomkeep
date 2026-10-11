import { type StatsDomainChoice } from "#lib/components/stats/stats-domain.js";
import type { StatsWindow, WatchStaleness } from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

/** What's left in each enabled domain's pile, unfiltered. */
export const getStatsPiles = (domain: StatsDomainChoice = "ALL") =>
  typedRequest("/stats/pile", { query: { domain } });

export const getStatsOverview = (domain: StatsDomainChoice = "ALL") =>
  typedRequest("/stats/overview", { query: { domain } });

export const getStatsWorksByRating = (
  domain: StatsDomainChoice,
  rating: number,
) =>
  typedRequest("/stats/works", {
    query: { domain, rating: String(rating) },
  });

export const getStatsWorksByDecade = (
  domain: StatsDomainChoice,
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

/** What the viewer was on around `date` (local YYYY-MM-DD) a year ago. */
export const getOnThisDay = (date: string) =>
  typedRequest("/stats/on-this-day", { query: { date } });
