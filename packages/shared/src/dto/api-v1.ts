import type {
  ListKind,
  ListVisibility,
  MediaType,
  ReviewTargetType,
  ReviewVisibility,
} from "../enums";
import type { StatsDomain, StatsStatusBucket } from "./stats";

// The public API's own shapes (`/api/v1`). They are a contract with scripts
// Loomkeep doesn't control: internal DTOs can change freely, these only grow
// (new optional fields) until a /v2.

/**
 * Library entries are filtered and read by their status normalised across
 * domains (the same buckets as the stats), next to each domain's own status.
 */
export type ApiV1Phase = StatsStatusBucket;

export const API_V1_LIBRARY_SORTS = [
  "added",
  "title",
  "rating",
  "finished",
] as const;
export type ApiV1LibrarySort = (typeof API_V1_LIBRARY_SORTS)[number];

export interface ApiV1WorkDto {
  /** Loomkeep's own id for the work. */
  id: string;
  domain: StatsDomain;
  /** MOVIE, SERIES or ANIME for video; null in the other domains. */
  type: MediaType | null;
  title: string;
  /** Book authors or album artists; empty for video and games. */
  creators: string[];
  coverUrl: string | null;
  /** The catalogue the work comes from (TMDB, ANILIST, IGDB…) and its id there. */
  source: string;
  sourceId: string;
  /** The work's page in the Loomkeep web app. */
  url: string;
}

export interface ApiV1ProgressDto {
  current: number;
  /** Null when the total isn't known (a game's length, a book without page count). */
  total: number | null;
  unit: "episodes" | "pages" | "minutes";
}

export interface ApiV1LibraryEntryDto {
  id: string;
  domain: StatsDomain;
  /** The domain's own status (WATCHING, PLAYING, READ, LISTENED…). */
  status: string;
  phase: ApiV1Phase;
  favorite: boolean;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  addedAt: string;
  /** Episodes for series/anime, pages for books, playtime for games; null otherwise. */
  progress: ApiV1ProgressDto | null;
  work: ApiV1WorkDto;
}

/** A list item, or a review's target: any work, season or episode. */
export interface ApiV1TargetDto {
  type: ReviewTargetType;
  id: string;
  title: string | null;
  imageUrl: string | null;
  /** Null for a target without its own page (a season, an episode). */
  url: string | null;
}

export interface ApiV1ListDto {
  id: string;
  title: string;
  description: string | null;
  kind: ListKind;
  visibility: ListVisibility;
  /** OWNER for the caller's lists, EDITOR for the ones shared with them. */
  role: "OWNER" | "EDITOR";
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiV1ListItemDto {
  id: string;
  position: number;
  addedAt: string;
  target: ApiV1TargetDto;
}

export interface ApiV1ListDetailDto extends ApiV1ListDto {
  items: ApiV1ListItemDto[];
}

export interface ApiV1CalendarEpisodeDto {
  airDate: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  /** Aired, unwatched episodes of the same show before this one. */
  episodesBehind: number;
  work: ApiV1WorkDto;
}

export interface ApiV1DomainStatsDto {
  domain: StatsDomain;
  total: number;
  favorites: number;
  byPhase: Record<ApiV1Phase, number>;
}

export interface ApiV1StatsSummaryDto {
  total: number;
  favorites: number;
  averageRating: number | null;
  domains: ApiV1DomainStatsDto[];
  /** Null when the domain is turned off for the account. */
  video: { totalMinutes: number; episodesWatched: number } | null;
  games: { totalPlaytimeMinutes: number } | null;
  books: {
    pagesRead: number;
    /** This year's reading goal; null when none is set. */
    readingGoal: { year: number; target: number; completed: number } | null;
  } | null;
  music: { listenDurationMin: number } | null;
}

export interface ApiV1ReviewDto {
  id: string;
  /** 0–10, half-points allowed. */
  rating: number;
  text: string | null;
  visibility: ReviewVisibility;
  spoiler: boolean;
  createdAt: string;
  updatedAt: string;
  target: ApiV1TargetDto;
}

export interface ApiV1ProfileDto {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  memberSince: string;
  /** Null when gamification is turned off on this instance. */
  progression: {
    xp: number;
    level: number;
    xpInLevel: number;
    xpToNext: number;
  } | null;
}

export interface ApiV1AchievementDto {
  /** Null for a secret achievement not unlocked yet. */
  key: string | null;
  family: string;
  tier: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number } | null;
}

export interface ApiV1NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  /** The episode's air date for a new episode, else when it was created. */
  date: string;
  createdAt: string;
}

export interface ApiV1NotificationsDto {
  unread: number;
  items: ApiV1NotificationDto[];
}
