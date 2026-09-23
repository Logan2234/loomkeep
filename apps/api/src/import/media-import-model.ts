/**
 * Canonical parse model for **media** import sources: each parses its own
 * export format down to this shape of shows + movies, which the source's
 * `buildPlan`/`commit` then resolve and write. Books and games have their own,
 * simpler parse models.
 */

import type { EntryStatus, MediaOwnershipStatus } from "@loomkeep/shared";

/** External identifiers a source may expose for a title (any subset). */
type ExternalIdMap = {
  tvdb?: string;
  tmdb?: string;
  imdb?: string;
  anilist?: string;
};

/** One distinct watched episode of a show, rewatches folded into the count. */
interface ImportWatchedEpisode {
  season: number;
  episode: number;
  /** The source's own episode id (e.g. TVDB) — used to fold in rewatch counts. */
  sourceEpisodeId: string;
  /** Approximate: sources store record-creation time, not real watch time. */
  watchedAt: Date | null;
  /** Base watch + rewatches. Always >= 1. */
  totalWatches: number;
  /**
   * Per-episode 1-10 rating, for sources that rate episodes individually
   * (IMDb). Written as a Review targeting the episode, not the show.
   */
  rating?: number | null;
}

export interface ImportShow {
  title: string;
  externalIds: ExternalIdMap;
  /** Distinct watched episodes; empty means the show is only on the watchlist. */
  episodes: ImportWatchedEpisode[];
  /** The source's own 1-10 rating, when it has one. */
  rating?: number | null;
  /** Marked as a favorite on the source. */
  favorite?: boolean;
  /** Explicit source status, for sources which expose one. */
  status?: EntryStatus;
  /** Source-level dates, distinct from per-episode watch dates. */
  startedAt?: Date | null;
  finishedAt?: Date | null;
  /** Private source note, if the source exports one. */
  notes?: string | null;
  /** When the user added it on the source — becomes the entry's creation date. */
  addedAt?: Date | null;
  /** Ownership metadata when the source has a meaningful equivalent. */
  ownershipStatus?: MediaOwnershipStatus;
  ownershipSource?: string | null;
}

export interface ImportMovie {
  title: string;
  year: number | null;
  /** true → watched (COMPLETED); false → watchlist (PLANNED). */
  watched: boolean;
  /** Earliest watch, null when unwatched or the source has no per-movie watch date. */
  watchedAt: Date | null;
  /** Extra watch dates beyond `watchedAt` (rewatches), oldest first. Empty when the source has no rewatch signal. */
  rewatchedAt: Date[];
  /** The source's own 1-10 rating, when it has one. */
  rating?: number | null;
  /** Marked as a favorite on the source. */
  favorite?: boolean;
  /** Private source note, if the source exports one. */
  notes?: string | null;
  /** Review body the source exports, written as the Review's text. */
  review?: string | null;
  /** When the user added it on the source — becomes the entry's creation date. */
  addedAt?: Date | null;
  externalIds: ExternalIdMap;
}

/**
 * A film inside an exported list. Deliberately the subset of
 * {@link ImportMovie} the matcher needs, so a list film resolves through the
 * exact same path — and shares its plan key when the film is also tracked.
 */
export interface ImportListFilm {
  title: string;
  year: number | null;
  externalIds: ExternalIdMap;
  /**
   * Which catalogue path resolves it. IMDb lists mix films and series, and a
   * series looked up as a film resolves to nothing. Absent means film.
   */
  type?: "MOVIE" | "SERIES";
}

/** One custom list the source exports (Letterboxd `lists/`, IMDb lists). */
export interface ImportList {
  name: string;
  description: string | null;
  /** Ranked lists keep their export order; the rest become a collection. */
  ranked: boolean;
  items: ImportListFilm[];
}

export interface ParsedImport {
  /** Which source produced this (matches the source id). */
  source: string;
  shows: ImportShow[];
  movies: ImportMovie[];
  /** Custom lists, when the source exports any. */
  lists?: ImportList[];
}
