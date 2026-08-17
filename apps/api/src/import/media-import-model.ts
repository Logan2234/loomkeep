/**
 * Canonical parse model for **media** import sources (TV Time today,
 * Trakt/Letterboxd/MAL tomorrow): each parses its own export format down to
 * this shape of shows + movies, which the source's `buildPlan`/`commit` then
 * resolve and write. Books and games have their own, simpler parse models.
 */

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
  externalIds: ExternalIdMap;
}

export interface ParsedImport {
  /** Which source produced this (matches the source id). */
  source: string;
  shows: ImportShow[];
  movies: ImportMovie[];
}
