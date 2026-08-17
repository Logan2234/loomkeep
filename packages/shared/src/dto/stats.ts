import { Domain, type MediaType } from "../enums";

/**
 * The domains covered by the stats feature today. A subset of `Domain`:
 * PODCASTS/BOARDGAMES are scaffolded but have no catalogue data yet, so they
 * stay out of stats aggregation until their own increment.
 */
export const STATS_DOMAINS = [
  Domain.MEDIA,
  Domain.GAMES,
  Domain.BOOKS,
  Domain.MUSIC,
] as const;
export type StatsDomain = (typeof STATS_DOMAINS)[number];

/**
 * Shared status vocabulary every domain's own status enum reduces to, so a
 * cross-domain view can sum counts without knowing each domain's specific
 * states (EntryStatus/GameStatus/BookStatus/MusicStatus all differ).
 */
export const StatsStatusBucket = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  DROPPED: "DROPPED",
} as const;
export type StatsStatusBucket =
  (typeof StatsStatusBucket)[keyof typeof StatsStatusBucket];

export interface StatusBucketCountDto {
  bucket: StatsStatusBucket;
  count: number;
}

/** One domain's library reduced to the shared status vocabulary. */
export interface DomainStatusBreakdownDto {
  domain: StatsDomain;
  total: number;
  favorites: number;
  byStatus: StatusBucketCountDto[];
}

/**
 * Ratio of entries with an opt-in ownership status (i.e. not NONE) below
 * which the possession breakdown reads as noise rather than signal — the UI
 * shows a "pas assez de données" guard instead of a near-empty chart.
 */
export const POSSESSION_MIN_RATIO = 0.3;

/** A possession breakdown either has enough opt-in data to show, or doesn't. */
export type PossessionBreakdownDto =
  | { sufficientData: true; byStatus: { status: string; count: number }[] }
  | { sufficientData: false; renseignedRatio: number };

/**
 * Time window for the temporal filters on /stats. Distinct from admin's
 * `TrendPeriod` (a bucket *size* for trend curves) — this is a filter
 * *window* applied to all-time aggregates.
 */
export type StatsWindow = "ALL" | "YEAR" | "MONTH" | "WEEK";

export interface RatingBucketDto {
  /** 1..10, integer. */
  rating: number;
  count: number;
}

export interface DecadeBucketDto {
  /** e.g. 1990 for the 1990s. */
  decade: number;
  count: number;
}

/**
 * The cross-domain (or single-domain, when filtered) all-time overview shown
 * at the top of /stats. `breakdowns` holds one entry per domain in scope —
 * one when filtered to a domain, several when "ALL" — so the front can
 * render either a domain-split or a status-funnel from the same data
 * (see DomainStatusBreakdownDto).
 */
export interface StatsOverviewDto {
  domain: "ALL" | StatsDomain;
  breakdowns: DomainStatusBreakdownDto[];
  total: number;
  favorites: number;
  /** DONE / total, 0 when total is 0. */
  completionRate: number;
  /** DROPPED / total, 0 when total is 0. */
  abandonRate: number;
  ratedCount: number;
  /** ratedCount / total, 0 when total is 0. */
  ratingRate: number;
  averageRating: number | null;
  /** Always 10 buckets (1..10), zero-filled — a stable histogram axis. */
  ratingDistribution: RatingBucketDto[];
  /** Ascending, only decades with at least one release date. */
  decades: DecadeBucketDto[];
  possession: PossessionBreakdownDto;
}

/** One work matching a rating or decade filter, for the drill-down modal. */
export interface StatsWorkDto {
  domain: StatsDomain;
  title: string;
  imageUrl: string | null;
  rating: number | null;
  href: string;
}

export interface VideoTypeSplitDto {
  type: MediaType;
  count: number;
  minutes: number;
}

interface VideoFilmExtremeDto {
  title: string;
  minutes: number;
  href: string;
}

// The Vidéo deep section on /stats — everything not already covered by the
// cross-domain overview (statuses/favorites live there via `breakdowns`).
export interface VideoStatsDto {
  totalMinutes: number;
  /** Episode viewings, rewatches included, specials excluded. */
  episodesWatched: number;
  /** Distinct episodes among `episodesWatched` — the difference is rewatches. */
  uniqueEpisodesWatched: number;
  // A season counts once every episode aired so far has been watched — a
  // still-airing season you're caught up on counts too.
  seasonsCompleted: number;
  /** Movie/series/anime split, by count and by minutes (for a count↔time toggle). */
  typeSplit: VideoTypeSplitDto[];
  avgEpisodeRuntimeMin: number | null;
  /** Only among movies with a known runtime; null when none do. */
  longestFilm: VideoFilmExtremeDto | null;
  shortestFilm: VideoFilmExtremeDto | null;
  /** Full ranked list, weighted by viewings — the front caps the display. */
  genres: { genre: string; count: number }[];
  /** WATCHING series/anime untouched 30-180 days. */
  pausedCount: number;
  /** WATCHING series/anime untouched 180+ days. */
  ghostCount: number;
  /** Most episode-watch events within any rolling 24h window. */
  longestBingeCount: number;
  /** Completed movie rewatches beyond each movie's first completion. */
  moviesRewatchedCount: number;
}

/** Staleness bucket for a WATCHING series/anime — mutually exclusive. */
export type WatchStaleness = "PAUSED" | "GHOST";

/** A count grouped by a free-form label (genre, platform…). */
export interface LabelCountDto {
  label: string;
  count: number;
}

// Average rating grouped by a free-form label (genre, platform…) — a game
// with several platforms/genres contributes to each group's average.
export interface RatingByGroupDto {
  label: string;
  averageRating: number;
  count: number;
}

interface GameTopEntryDto {
  title: string;
  minutes: number;
  href: string;
}

// The Jeux deep section on /stats — everything not already covered by the
// cross-domain overview (statuses/favorites/decades live there).
export interface GameStatsDto {
  totalPlaytimeMinutes: number;
  avgPlaytimePerCompletedMinutes: number | null;
  neverLaunchedCount: number;
  /** Completed replays beyond each game's first completion. */
  replaysCount: number;
  /** Full ranked list, minutes descending — the front caps the display. */
  topGamesByPlaytime: GameTopEntryDto[];
  topPlatforms: LabelCountDto[];
  topGenres: LabelCountDto[];
  avgRatingByPlatform: RatingByGroupDto[];
  avgRatingByGenre: RatingByGroupDto[];
}

interface BookExtremeDto {
  title: string;
  pages: number;
  href: string;
}

interface AuthorPagesDto {
  author: string;
  pages: number;
}

// The Livres deep section on /stats — everything not already covered by the
// cross-domain overview (statuses/favorites/decades/possession/ratings live
// there).
export interface BookStatsDto {
  /** Pages counted from READ books (full) plus READING books (current position). */
  pagesRead: number;
  /** Across READ books with a known page count; null when none do. */
  avgPagesPerRead: number | null;
  /** Only among READ books with a known page count; null when none do. */
  longestBook: BookExtremeDto | null;
  shortestBook: BookExtremeDto | null;
  /** Full ranked list, pages descending — the front caps the display. */
  topAuthorsByPages: AuthorPagesDto[];
  /** Across the whole library, any status. */
  distinctAuthorsCount: number;
  /** Completed rereads beyond each book's first completion. */
  rereadsCount: number;
  // READING entries untouched 30+ days (proxy: `updatedAt`, the entry has
  // no per-page-turn log).
  stagnantInProgressCount: number;
}

// The Musique deep section on /stats — everything not already covered by
// the cross-domain overview (statuses/favorites/decades/possession/ratings
// live there).
export interface MusicStatsDto {
  /** Sum of `durationMin` across LISTENED albums with a known duration. */
  listenDurationMin: number;
  /** Sum of `trackCount` across the whole library, any status. */
  totalTracks: number;
  /** Across the whole library, any status. */
  distinctArtistsCount: number;
  /** By album count, full ranked list — the front caps the display. */
  topArtists: LabelCountDto[];
  /** Album/EP/Single/Compilation…, full ranked list. */
  releaseTypeSplit: LabelCountDto[];
}

export interface HeatmapDayDto {
  /** ISO date, e.g. "2026-07-15". */
  date: string;
  count: number;
}

export interface WeekdayCountDto {
  /** 0=Sunday..6=Saturday (UTC). */
  weekday: number;
  count: number;
}

export interface HourCountDto {
  /** 0..23 (UTC). */
  hour: number;
  count: number;
}

export interface MonthMinutesDto {
  /** e.g. "2026-07". */
  month: string;
  minutes: number;
}

export interface YearMinutesDto {
  year: number;
  minutes: number;
}

/**
 * Vidéo's "activité dans le temps" section — the only domain with a true
 * per-event log (EpisodeWatch), so temporal stats start here. The heatmap
 * and monthly/yearly bars always span their own natural full range; only
 * `byWeekday`/`byHour` respect the requested `StatsWindow`.
 */
export interface VideoTemporalDto {
  /** Daily watch counts, last 365 days, zero-filled. */
  heatmap: HeatmapDayDto[];
  /** 7 zero-filled buckets, within the requested window. */
  byWeekday: WeekdayCountDto[];
  /** 24 zero-filled buckets, within the requested window. */
  byHour: HourCountDto[];
  /** Last 12 calendar months, zero-filled, chronological. */
  monthlyMinutes: MonthMinutesDto[];
  /** Every year with activity, ascending. */
  yearlyMinutes: YearMinutesDto[];
  /** The year from `yearlyMinutes` with the most minutes; null if no data. */
  mostActiveYear: number | null;
}

export interface MonthCountDto {
  /** e.g. "2026-07". */
  month: string;
  count: number;
}

/**
 * "Your average vs the community" needs enough works rated by both you and
 * at least one other user to mean anything — below the threshold it reads
 * as noise, so the front shows a "pas assez de données" guard instead.
 */
export const RATING_VS_COMMUNITY_MIN_SAMPLE = 10;

export type RatingVsCommunityDto =
  | {
      sufficientData: true;
      yourAverage: number;
      communityAverage: number;
      sampleSize: number;
    }
  | { sufficientData: false; sampleSize: number };

/**
 * The Social section on /stats — gated by SOCIAL_ENABLED (invisible, not
 * empty, on self-host). All figures are the viewer's own activity; nothing
 * here needs a visibility check since it's always self-view (mirrors /stats
 * being a private dashboard).
 */
export interface SocialStatsDto {
  reviewsWritten: number;
  /** Across reviews with non-empty text; null when none do. */
  avgReviewLength: number | null;
  ratingVsCommunity: RatingVsCommunityDto;
  commentsWritten: number;
  rootCommentsCount: number;
  replyCommentsCount: number;
  /** 0..1, 0 when `commentsWritten` is 0. */
  spoilerCommentRatio: number;
  /** Edits made across all your reviews (ReviewRevision rows). */
  reviewRevisionsCount: number;
  /** UP votes received on your reviews. */
  helpfulVotesReceived: number;
  /** UP votes on your single most-voted review; null when you have none. */
  mostVotedReviewVotes: number | null;
  reactionsGiven: number;
  reactionsReceived: number;
  listsWritten: number;
  listsPublicCount: number;
  /** Last 12 calendar months, zero-filled, chronological. */
  newFollowersByMonth: MonthCountDto[];
  /** Of the followers gained across those 12 months, the share you follow back. */
  followerReciprocityRate: number;
  /** Reviews + comments per month, last 12 months, zero-filled. */
  socialActivityByMonth: MonthCountDto[];
  /** Consecutive days with a review or comment, same rule as the video streak. */
  contributionStreakDays: number;
}
