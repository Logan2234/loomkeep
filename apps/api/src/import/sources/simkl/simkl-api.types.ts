/**
 * Shapes of the Simkl REST API (api.simkl.com) responses this import
 * consumes — verified against Simkl's own OpenAPI spec (api.simkl.org/openapi.json),
 * not guessed from an undocumented export file.
 */

/** `GET /sync/all-items/all/all` — one status bucket a movie can sit in. */
export type SimklWatchlistStatus =
  "watching" | "plantowatch" | "hold" | "completed" | "dropped";

export interface SimklIds {
  simkl: number;
  slug?: string;
  imdb?: string;
  tvdb?: string;
  tmdb?: string;
  mal?: string;
  anidb?: string;
  anilist?: string;
}

interface SimklShowRef {
  title: string;
  year: number | null;
  ids: SimklIds;
}

interface SimklMovieRef {
  title: string;
  year: number | null;
  ids: SimklIds;
}

export interface SimklEpisode {
  number: number;
  /** Present with `episode_watched_at=yes` (requires `extended=full`). */
  watched_at?: string;
}

export interface SimklSeason {
  number: number;
  episodes: SimklEpisode[];
}

/** One show/anime entry, keyed under `show` even for anime items. */
export interface SimklShowEntry {
  status: SimklWatchlistStatus;
  show: SimklShowRef;
  /** Present with `extended=full`; absent for a watchlist-only (never started) entry. */
  seasons?: SimklSeason[];
}

/** One movie entry. */
export interface SimklMovieEntry {
  status: SimklWatchlistStatus;
  movie: SimklMovieRef;
}

/**
 * `GET /sync/all-items/all/all` response — top-level dict keyed by `shows`,
 * `movies`, `anime`; a key is present only when that bucket has ≥1 item.
 */
export interface SimklAllItemsResponse {
  shows?: SimklShowEntry[];
  anime?: SimklShowEntry[];
  movies?: SimklMovieEntry[];
}
