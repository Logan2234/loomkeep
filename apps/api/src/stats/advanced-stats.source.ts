import type {
  BookStatsDto,
  GameStatsDto,
  MusicStatsDto,
  SocialStatsDto,
  StatsOverviewDto,
  StatsWindow,
  VideoStatsDto,
  VideoTemporalDto,
} from "@loomkeep/shared";
import { computeRatingDistribution } from "./rating-distribution.util";
import { computeHourCounts, computeWeekdayCounts } from "./video-temporal.util";

// The advanced statistics are a premium feature under LICENSE-EE: ee/stats
// computes them and hands itself to StatsService at startup, so the AGPL core
// never imports ee/. The core computes the free fields and, without ee/ (or
// for a free account), fills the advanced ones with the empty values below —
// the locked shape the stats page renders its teasers from.

export type OverviewAdvanced = Pick<
  StatsOverviewDto,
  "ratingDistribution" | "decades" | "possession"
>;
export type VideoAdvanced = Pick<
  VideoStatsDto,
  | "longestFilm"
  | "shortestFilm"
  | "genres"
  | "pausedCount"
  | "ghostCount"
  | "longestBingeCount"
  | "moviesRewatchedCount"
>;
export type GameAdvanced = Pick<
  GameStatsDto,
  | "topGamesByPlaytime"
  | "topPlatforms"
  | "topGenres"
  | "avgRatingByPlatform"
  | "avgRatingByGenre"
>;
export type BookAdvanced = Pick<
  BookStatsDto,
  "longestBook" | "shortestBook" | "topAuthorsByPages" | "distinctAuthorsCount"
>;
export type MusicAdvanced = Pick<
  MusicStatsDto,
  "topArtists" | "releaseTypeSplit"
>;

/** What the core already loaded, so ee/ doesn't query it a second time. */
export interface OverviewInput {
  ratings: number[];
  rows: { releaseDate: Date | null; ownershipStatus: string }[];
}

export interface VideoInput {
  /** One per episode watch (season 0 excluded). */
  episodeWatches: { watchedAt: Date | null; genres: string[] }[];
  completedMovies: {
    title: string;
    runtimeMin: number | null;
    genres: string[];
    href: string;
    /** 1 + rewatches. */
    viewings: number;
  }[];
}

export interface GameInput {
  entries: {
    itemId: string;
    title: string;
    href: string;
    playtimeMinutes: number;
    genres: string[];
    platforms: string[];
  }[];
}

export interface BookInput {
  entries: {
    status: string;
    title: string;
    href: string;
    pageCount: number | null;
    authors: string[];
  }[];
}

export interface MusicInput {
  entries: { artists: string[]; albumType: string | null }[];
}

/**
 * Each method returns null when this instance may not run the advanced
 * statistics (no license, see ee/licensing): the core then serves the empty
 * values, as for a free account.
 */
export interface AdvancedStatsSource {
  overview(input: OverviewInput): OverviewAdvanced | null;
  video(userId: string, input: VideoInput): Promise<VideoAdvanced | null>;
  games(userId: string, input: GameInput): Promise<GameAdvanced | null>;
  books(input: BookInput): BookAdvanced | null;
  music(input: MusicInput): MusicAdvanced | null;
  videoTemporal(
    userId: string,
    period: StatsWindow,
  ): Promise<VideoTemporalDto | null>;
  social(userId: string): Promise<SocialStatsDto | null>;
}

export function emptyOverviewAdvanced(): OverviewAdvanced {
  return {
    ratingDistribution: computeRatingDistribution([]),
    decades: [],
    possession: { sufficientData: false, renseignedRatio: 0 },
  };
}

export const EMPTY_VIDEO_ADVANCED: VideoAdvanced = {
  longestFilm: null,
  shortestFilm: null,
  genres: [],
  pausedCount: 0,
  ghostCount: 0,
  longestBingeCount: 0,
  moviesRewatchedCount: 0,
};

export const EMPTY_GAME_ADVANCED: GameAdvanced = {
  topGamesByPlaytime: [],
  topPlatforms: [],
  topGenres: [],
  avgRatingByPlatform: [],
  avgRatingByGenre: [],
};

export const EMPTY_BOOK_ADVANCED: BookAdvanced = {
  longestBook: null,
  shortestBook: null,
  topAuthorsByPages: [],
  distinctAuthorsCount: 0,
};

export const EMPTY_MUSIC_ADVANCED: MusicAdvanced = {
  topArtists: [],
  releaseTypeSplit: [],
};

export function emptyVideoTemporal(): VideoTemporalDto {
  return {
    heatmap: [],
    byWeekday: computeWeekdayCounts([]),
    byHour: computeHourCounts([]),
    monthlyMinutes: [],
    yearlyMinutes: [],
    mostActiveYear: null,
  };
}

export const EMPTY_SOCIAL_STATS: SocialStatsDto = {
  reviewsWritten: 0,
  avgReviewLength: null,
  ratingVsCommunity: { sufficientData: false, sampleSize: 0 },
  commentsWritten: 0,
  rootCommentsCount: 0,
  replyCommentsCount: 0,
  spoilerCommentRatio: 0,
  reviewRevisionsCount: 0,
  helpfulVotesReceived: 0,
  mostVotedReviewVotes: null,
  reactionsGiven: 0,
  reactionsReceived: 0,
  listsWritten: 0,
  listsPublicCount: 0,
  newFollowersByMonth: [],
  followerReciprocityRate: 0,
  socialActivityByMonth: [],
  contributionStreakDays: 0,
};
