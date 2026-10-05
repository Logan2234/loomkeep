import type {
  CatalogSource,
  Domain,
  EntryStatus,
  MediaOwnershipStatus,
  MediaType,
} from "../enums";
import type { GameItemDto } from "./game";

export const ENTRY_NOTES_MAX_LENGTH = 5000;
export const OWNERSHIP_SOURCE_MAX_LENGTH = 100;

/**
 * Tracked-item count per domain, hidden domains included — the settings
 * "Domaines" tiles need to say what turning one off would take out of the
 * navigation, which the enabled-domain-scoped stats endpoints can't tell them.
 */
export type LibraryDomainCountsDto = Partial<Record<Domain, number>>;

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
  /** Not out yet (unreleased film, unaired anime); absent on older responses. */
  upcoming?: boolean;
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
  /** When the entry was last updated (ISO). */
  updatedAt: string;
  /** Most recent viewing (max episode watch, else the movie's finishedAt); null if never. */
  lastWatchedAt: string | null;
  /** Episode progress, only for series/anime. */
  progress: ProgressDto | null;
  /** How the user holds this title, if set (NONE = unset). */
  ownershipStatus: MediaOwnershipStatus;
  /** Free-form detail for DIGITAL/STREAMING (e.g. "Netflix"); null otherwise. */
  ownershipSource: string | null;
  /** Series/anime: left out of the new-episode push/email digest (still in the calendar). */
  episodeAlertsMuted: boolean;
  movieReleaseAlertsEnabled?: boolean;
  /** Completed rewatches beyond the first, movies only, most recent first. */
  replays: MovieReplayDto[];
}

export interface MovieReplayDto {
  id: string;
  /** ISO date the rewatch was completed. */
  finishedAt: string;
}

/**
 * A WATCHING series/anime is "dormant" once nothing has been watched for this
 * many days — a derived signal, orthogonal to the status (there is no PAUSED
 * status: a paused show is just a WATCHING one left alone).
 */
export const DORMANT_AFTER_DAYS = 30;

/** Whether an entry is a WATCHING series/anime with no recent viewing. */
export function isDormant(
  entry: Pick<LibraryEntryDto, "status" | "lastWatchedAt">,
  now: Date = new Date(),
): boolean {
  if (entry.status !== "WATCHING" || !entry.lastWatchedAt) return false;
  const elapsedMs = now.getTime() - new Date(entry.lastWatchedAt).getTime();
  return elapsedMs > DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** A dormant series/anime left alone this many days is a "ghost". */
export const GHOST_AFTER_DAYS = 180;

/** Whether a dormant entry has gone untouched long enough to be a ghost. */
export function isGhost(
  entry: Pick<LibraryEntryDto, "status" | "lastWatchedAt">,
  now: Date = new Date(),
): boolean {
  if (entry.status !== "WATCHING" || !entry.lastWatchedAt) return false;
  const elapsedMs = now.getTime() - new Date(entry.lastWatchedAt).getTime();
  return elapsedMs >= GHOST_AFTER_DAYS * 24 * 60 * 60 * 1000;
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

export interface EpisodeWatchDto {
  id: string;
  episodeId: string;
  watchedAt: string | null;
}

/** Persisted episode enriched with the current user's watch count. */
export interface EpisodeWithWatchesDto {
  id: string;
  number: number;
  title: string | null;
  airDate: string | null;
  watchCount: number;
}

export interface SeasonWithWatchesDto {
  id: string;
  number: number;
  title: string | null;
  episodes: EpisodeWithWatchesDto[];
}

export interface EntryEpisodesResponseDto {
  seasons: SeasonWithWatchesDto[];
}

/** An upcoming episode, local movie release or game release from the user's library. */
export interface CalendarEntryDto {
  /** The show or movie; null for a game. */
  mediaItem: MediaItemDto | null;
  /** The game; null for a show or movie. */
  game: GameItemDto | null;
  /** The user's library entry for the work — the target for muting its alerts. */
  entryId: string;
  /** Show-level mute; for movies and games, true means the user has not opted into a release reminder. */
  episodeAlertsMuted: boolean;
  /**
   * The show's regular episodes aired before today that the user hasn't
   * watched — the backlog to catch up on before this one.
   */
  episodesBehind: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  releaseRegion?: string;
  releaseType?: "cinema" | "digital";
  /** A game dated to a month sits on its 1st. */
  releasePrecision?: "DAY" | "MONTH";
  /** ISO air date (always in the future for the calendar feed). */
  airDate: string;
}

/** The opaque token used in the public .ics subscription URL. */
export interface CalendarTokenDto {
  token: string;
}

export function episodeCode(
  season: number | null,
  episode: number | null,
): string {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

export function progressPercent(
  progress:
    Pick<ProgressDto, "watchedEpisodes" | "totalEpisodes"> | null | undefined,
): number {
  if (!progress || progress.totalEpisodes === 0) return 0;
  return Math.round((progress.watchedEpisodes / progress.totalEpisodes) * 100);
}
