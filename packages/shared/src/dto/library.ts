import type {
  CatalogSource,
  EntryStatus,
  MediaOwnershipStatus,
  MediaType,
} from "../enums";

/** A persisted media referenced by at least one user (on-demand cache). */
export interface MediaItemDto {
  id: string;
  type: MediaType;
  title: string;
  posterUrl: string | null;
  canonicalSource: CatalogSource;
  /**
   * External ID in `canonicalSource`. With `type` it forms the catalogue
   * identity used to address the media page (`/media/{type}/{sourceId}`).
   */
  sourceId: string;
}

export interface LibraryEntryDto {
  id: string;
  mediaItem: MediaItemDto;
  status: EntryStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** When the entry was added to the library (ISO). */
  createdAt: string;
  /** Most recent viewing (max episode watch, else the movie's finishedAt); null if never. */
  lastWatchedAt: string | null;
  /** Episode progress, only for series/anime. */
  progress: ProgressDto | null;
  /** How the user holds this title, if set (NONE = unset). */
  ownershipStatus: MediaOwnershipStatus;
  /** Free-form detail for DIGITAL/STREAMING (e.g. "Netflix"); null otherwise. */
  ownershipSource: string | null;
}

/**
 * A WATCHING series/anime is "dormant" once nothing has been watched for this
 * many days — a derived signal, orthogonal to the status (there is no PAUSED
 * status: a paused show is just a WATCHING one left alone).
 */
export const DORMANT_AFTER_DAYS = 30;

/** Whether an entry is a WATCHING series/anime with no recent viewing. */
export function isDormant(
  entry: LibraryEntryDto,
  now: Date = new Date(),
): boolean {
  if (entry.status !== "WATCHING" || !entry.lastWatchedAt) return false;
  const elapsedMs = now.getTime() - new Date(entry.lastWatchedAt).getTime();
  return elapsedMs > DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** The next episode to watch (first released, unwatched regular episode). */
export interface NextEpisodeDto {
  episodeId: string;
  seasonNumber: number;
  episodeNumber: number;
}

export interface ProgressDto {
  watchedEpisodes: number;
  totalEpisodes: number;
  /** One-click "resume" target; null when caught up (or nothing released next). */
  nextEpisode: NextEpisodeDto | null;
}

/** Body for creating/updating a library entry from a catalogue media. */
export interface UpsertLibraryEntryDto {
  source: CatalogSource;
  sourceId: string;
  /** Required because TMDB movie and TV IDs live in separate namespaces. */
  type: MediaType;
  status?: EntryStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
}

/** One watch event for one episode; several rows for the same episode = rewatches. */
export interface EpisodeWatchDto {
  id: string;
  episodeId: string;
  watchedAt: string;
}

/** Persisted episode enriched with the current user's watch count. */
interface EpisodeWithWatchesDto {
  id: string;
  number: number;
  title: string | null;
  airDate: string | null;
  watchCount: number;
}

interface SeasonWithWatchesDto {
  id: string;
  number: number;
  title: string | null;
  episodes: EpisodeWithWatchesDto[];
}

export interface EntryEpisodesResponseDto {
  seasons: SeasonWithWatchesDto[];
}

/** An upcoming episode of a tracked series/anime (release calendar). */
export interface CalendarEntryDto {
  mediaItem: MediaItemDto;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  /** ISO air date (always in the future for the calendar feed). */
  airDate: string;
}

/** The opaque token used in the public .ics subscription URL. */
export interface CalendarTokenDto {
  token: string;
}
