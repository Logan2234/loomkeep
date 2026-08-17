/**
 * Shapes of Trakt's own account data export (Settings → Data → Export on
 * trakt.tv, a free-tier feature — unlike the live API, whose Client ID now
 * requires Trakt VIP to create). Reverse-engineered from a real populated
 * export, not the API docs: the export is a `.zip` of many small JSON files,
 * one per data category.
 */

interface TraktIds {
  trakt: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

interface TraktMovieRef {
  title: string;
  year: number | null;
  ids: TraktIds;
}

interface TraktShowRef {
  title: string;
  year: number | null;
  ids: TraktIds;
}

interface TraktEpisodeRef {
  title: string | null;
  season: number;
  number: number;
}

/**
 * One row of `watched-history-N.json` (or the unsplit `watched-history.json`
 * on a small library) — one row per watch **event**, confirmed to be a
 * strict superset of `watched-movies.json`/`watched-shows.json` (those only
 * carry aggregates, no per-episode breakdown) against a real export, so it's
 * the only file this import reads for watched data.
 */
export interface TraktHistoryEntry {
  watched_at: string;
  type: "movie" | "episode";
  movie?: TraktMovieRef;
  show?: TraktShowRef;
  episode?: TraktEpisodeRef;
}

/**
 * One row of `lists-watchlist.json`. Unlike {@link TraktHistoryEntry}, this
 * shape is **not** confirmed against real data (empty in every export sample
 * seen so far) — inferred from the same `{ids, title, year}` convention every
 * other file in the export follows, and from Trakt's live API (which shares
 * the same object shapes). Treat this as best-effort until verified.
 */
export interface TraktWatchlistEntry {
  listed_at?: string;
  type: "movie" | "show";
  movie?: TraktMovieRef;
  show?: TraktShowRef;
}
