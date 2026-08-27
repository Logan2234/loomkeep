import type { GameOwnershipStatus, GameSource, GameStatus } from "../enums";
import type { RatingDto } from "./catalog";

/** A game as returned by a live catalogue search (not persisted). */
export interface GameSummaryDto {
  source: GameSource;
  sourceId: string;
  title: string;
  /** First release year, when known. */
  year: number | null;
  coverUrl: string | null;
  /** 18+ title (IGDB "Erotic" theme). Restricted per-account, like media. */
  isAdult: boolean;
}

export interface GameSearchResponseDto {
  results: GameSummaryDto[];
}

/** Full game details, fetched live from the source. */
export interface GameDetailsDto extends GameSummaryDto {
  overview: string | null;
  /** Wide artwork/screenshot for the detail header, when available. */
  backdropUrl: string | null;
  /** Screenshot gallery, for the detail page's lightbox carousel. */
  screenshots: string[];
  genres: string[];
  platforms: string[];
  /** ISO first-release date; null when the source has none. */
  releaseDate: string | null;
  /** Official website of the game, when the source exposes one. */
  website: string | null;
  /** IGDB's own "similar games" recommendations, capped to a handful. */
  similarGames: GameSummaryDto[];
  developers: string[];
  publishers: string[];
  /** Solo/coop/multiplayer… */
  gameModes: string[];
  /** First/third person, VR… */
  playerPerspectives: string[];
  /** Other games from the same franchise(s), excluding this one. */
  franchiseGames: GameSummaryDto[];
  /** Name of the first franchise this game belongs to, when known. */
  franchiseName: string | null;
  /** IGDB's own user rating + critic aggregate, when known. */
  ratings: RatingDto[];
  /** Deeper narrative summary, distinct from `overview`, when IGDB has one. */
  storyline: string | null;
  /** YouTube video id for a trailer, when IGDB lists one. */
  trailerVideoId: string | null;
  /** Age rating badge images (ESRB/PEGI/…), when IGDB has classified the game. */
  ageRatingImageUrls: string[];
  /** Multiplayer modes beyond the generic `gameModes` (co-op, split screen…). */
  multiplayerModes: string[];
}

/** A persisted game referenced by at least one user (on-demand cache). */
export interface GameItemDto {
  id: string;
  title: string;
  coverUrl: string | null;
  canonicalSource: GameSource;
  /** External ID in `canonicalSource`, used to address the game detail page. */
  sourceId: string;
}

/** One completed replay, beyond the entry's own (first) completion. */
export interface GameReplayDto {
  id: string;
  /** ISO date the replay was completed. */
  finishedAt: string;
}

export interface GameEntryDto {
  id: string;
  game: GameItemDto;
  status: GameStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  /** Total time played, in minutes (imported from Steam or set manually). */
  playtimeMinutes: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** When the entry was added to the library (ISO). */
  createdAt: string;
  /** Completed replays beyond the first, most recent first. */
  replays: GameReplayDto[];
  /** How the user holds this game, if set (NONE = unset). */
  ownershipStatus: GameOwnershipStatus;
  /** Free-form detail for DIGITAL/SUBSCRIPTION (e.g. "Steam"); null otherwise. */
  ownershipSource: string | null;
}

/** Body for creating/updating a library entry from a catalogue game. */
export interface UpsertGameEntryDto {
  source: GameSource;
  sourceId: string;
  status?: GameStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
}

/** Body for patching an existing game library entry. */
export interface UpdateGameEntryDto {
  status?: GameStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  /** Total time played, in minutes. */
  playtimeMinutes?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  ownershipStatus?: GameOwnershipStatus;
  ownershipSource?: string | null;
}

/**
 * Everything the game detail page needs in one call: catalogue metadata
 * (cached if persisted, else fetched live) + the current user's library state.
 * `entry` is null when the game is not in the library.
 */
export interface GameDetailDto extends GameDetailsDto {
  entry: GameEntryDto | null;
}
