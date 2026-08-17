/**
 * Shapes of the Trakt REST API (api.trakt.tv) responses this import consumes.
 * Undocumented via a machine-readable OpenAPI spec, but stable and long
 * public — see https://trakt.docs.apiary.io.
 */

export interface TraktIds {
  trakt: number;
  slug?: string;
  tvdb?: number;
  imdb?: string;
  tmdb?: number;
}

interface TraktShow {
  title: string;
  year: number | null;
  ids: TraktIds;
}

interface TraktMovie {
  title: string;
  year: number | null;
  ids: TraktIds;
}

interface TraktWatchedEpisode {
  number: number;
  plays: number;
  last_watched_at: string;
}

interface TraktWatchedSeason {
  number: number;
  episodes: TraktWatchedEpisode[];
}

/** One entry of `GET /users/{id}/watched/shows`. */
export interface TraktWatchedShow {
  show: TraktShow;
  seasons: TraktWatchedSeason[];
}

/** One entry of `GET /users/{id}/watched/movies`. */
export interface TraktWatchedMovie {
  movie: TraktMovie;
}

/** One entry of `GET /users/{id}/watchlist/shows`. */
export interface TraktWatchlistShowItem {
  show: TraktShow;
}

/** One entry of `GET /users/{id}/watchlist/movies`. */
export interface TraktWatchlistMovieItem {
  movie: TraktMovie;
}
