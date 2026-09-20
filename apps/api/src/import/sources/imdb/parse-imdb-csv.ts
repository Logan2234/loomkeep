import { parseCsv } from "../../csv";
import type { ImportMovie, ImportShow } from "../../media-import-model";

/**
 * One IMDb CSV export — the ratings file or the watchlist. They share a column
 * vocabulary, so one parser covers both and which one it is gets inferred from
 * the header rather than asked of the user.
 *
 * Custom lists are out: their name exists only in the downloaded file's name,
 * which the analyze request does not carry — see the PR for why that plumbing
 * is kept separate.
 *
 * `Const` (`tt…`) is the point of this source: it resolves exactly through
 * TMDB's `/find`, where Letterboxd can only be matched on title and year.
 *
 * Deliberately unused, being catalogue metadata Loomkeep fetches itself:
 * `IMDb Rating`, `Num Votes`, `Runtime (mins)`, `Genres`, `Release Date`,
 * `Directors`, `URL`, `Original Title`, `Modified`.
 */

/** IMDb rates episodes; they are resolved later, against TMDB. */
export interface ImdbRatedEpisode {
  imdbId: string;
  rating: number | null;
}

export interface ImdbExport {
  shows: ImportShow[];
  movies: ImportMovie[];
  ratedEpisodes: ImdbRatedEpisode[];
}

const MOVIE_TYPES = new Set([
  "movie",
  "tv movie",
  "short",
  "tv short",
  "video",
  "tv special",
]);
const SERIES_TYPES = new Set([
  "tv series",
  "tv mini series",
  "tv mini-series",
  "tv miniseries",
]);
const EPISODE_TYPE = "tv episode";

export function parseImdbCsv(text: string): ImdbExport {
  const rows = parseCsv(stripBom(text));
  const movies: ImportMovie[] = [];
  const shows: ImportShow[] = [];
  const ratedEpisodes: ImdbRatedEpisode[] = [];

  // The ratings file is proof of viewing by itself; the watchlist, which a
  // `Position` column marks, holds what has not been seen.
  const isRatings = !("Position" in (rows[0] ?? {}));

  for (const row of rows) {
    const imdbId = row.Const?.trim();
    const title = row.Title?.trim() || row["Original Title"]?.trim();
    if (!imdbId || !title) continue;

    const type = row["Title Type"]?.trim().toLowerCase() ?? "";
    const rating = parseRating(row["Your Rating"]);
    const year = parseYear(row.Year);
    // On a list row this is the user's own note about the item.
    const notes = row.Description?.trim() || null;
    const addedAt = parseDate(row.Created);

    if (type === EPISODE_TYPE) {
      ratedEpisodes.push({ imdbId, rating });
      continue;
    }

    const isMovie = MOVIE_TYPES.has(type);
    const isSeries = SERIES_TYPES.has(type);
    // Rating something is how IMDb records having seen it.
    const watched = isRatings || rating !== null;

    if (isMovie) {
      movies.push({
        title,
        year,
        watched,
        // `Date Rated` is when the rating was typed, not when the film was
        // seen: someone rating a back catalogue in one sitting would have
        // every one of those films land on today's date.
        watchedAt: null,
        rewatchedAt: [],
        rating,
        notes,
        addedAt,
        externalIds: { imdb: imdbId },
      });
      continue;
    }

    if (isSeries) {
      shows.push({
        title,
        externalIds: { imdb: imdbId },
        // The export says nothing about which episodes were seen, so progress
        // stays empty and the status is stated outright.
        episodes: [],
        rating,
        status: watched ? "COMPLETED" : "PLANNED",
        notes,
        addedAt,
      });
    }

    // Everything else IMDb tracks — video games, podcasts, music videos — has
    // no home in this domain and is dropped rather than half-imported.
  }

  return { shows, movies, ratedEpisodes };
}

/**
 * IMDb exported these as Windows-1252 for years and switched to UTF-8 with a
 * byte-order mark, which would otherwise poison the first header name.
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseYear(raw: string | undefined): number | null {
  const year = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(year) ? year : null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const date = new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

/** IMDb already rates out of 10, which is Loomkeep's own scale. */
function parseRating(raw: string | undefined): number | null {
  const rating = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) return null;
  return rating;
}
