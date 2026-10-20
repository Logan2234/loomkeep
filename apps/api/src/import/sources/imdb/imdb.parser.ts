import { parseCsv } from "../../../common/csv.util";
import { parseDateOrNull } from "../../import-date.util";
import type {
  ImportList,
  ImportListFilm,
  ImportMovie,
  ImportShow,
} from "../../media-import-model";

/**
 * IMDb's CSV exports — the ratings file, the watchlist and any custom list —
 * taken together in one run. They share a column vocabulary; what tells them
 * apart is the `Position` column (absent from the ratings) and, between the
 * watchlist and a list, only the downloaded file's name.
 *
 * `Const` (`tt…`) is the point of this source: it resolves exactly through
 * TMDB's `/find`, where Letterboxd can only be matched on title and year.
 *
 * Deliberately unused, being catalogue metadata Loomkeep fetches itself:
 * `IMDb Rating`, `Num Votes`, `Runtime (mins)`, `Genres`, `Release Date`,
 * `Directors`, `URL`, `Original Title`, `Modified`.
 */

/** One uploaded file. `name` is null for a payload sent as bare CSV text. */
export interface ImdbFile {
  name: string | null;
  text: string;
}

/** IMDb rates episodes; they are located later, against TMDB. */
export interface ImdbRatedEpisode {
  imdbId: string;
  rating: number | null;
}

export interface ImdbExport {
  shows: ImportShow[];
  movies: ImportMovie[];
  ratedEpisodes: ImdbRatedEpisode[];
  lists: ImportList[];
}

type TitleKind = "movie" | "series" | "episode";

/**
 * `Title Type`, lowercased with everything but letters removed: IMDb has
 * written the same type as "TV Series", "tvSeries" and, in old exports,
 * "Mini-Series" or "Feature Film".
 */
const TITLE_KINDS: Record<string, TitleKind> = {
  movie: "movie",
  featurefilm: "movie",
  tvmovie: "movie",
  short: "movie",
  shortfilm: "movie",
  tvshort: "movie",
  video: "movie",
  tvspecial: "movie",
  documentary: "movie",
  tvseries: "series",
  tvminiseries: "series",
  miniseries: "series",
  tvepisode: "episode",
  episode: "episode",
};

const IMDB_ID = /^tt\d+$/;

export function parseImdbExport(files: ImdbFile[]): ImdbExport {
  const movies = new Map<string, ImportMovie>();
  const shows = new Map<string, ImportShow>();
  const episodes = new Map<string, ImdbRatedEpisode>();
  const lists: ImportList[] = [];

  for (const file of files) {
    const rows = parseCsv(stripBom(file.text));
    // The ratings file is proof of viewing by itself; the watchlist and the
    // lists, which a `Position` column marks, hold what may not be seen.
    const isRatings = rows.length > 0 && !("Position" in rows[0]);
    const listName = isRatings ? null : customListName(file.name);

    if (listName !== null) {
      const list = parseList(listName, rows);
      if (list.items.length > 0) lists.push(list);
      continue;
    }

    for (const row of rows) {
      const imdbId = row.Const?.trim() ?? "";
      const title = row.Title?.trim() || row["Original Title"]?.trim();
      if (!IMDB_ID.test(imdbId) || !title) continue;

      const kind = titleKind(row["Title Type"]);
      const rating = parseRating(row["Your Rating"]);
      // Rating something is how IMDb records having seen it.
      const watched = isRatings || rating !== null;

      if (kind === "episode") {
        // An unrated episode on the watchlist was never watched.
        if (watched) mergeEpisode(episodes, { imdbId, rating });
        continue;
      }

      const fields = {
        title,
        rating,
        // On the watchlist this is the user's own note about the title.
        notes: row.Description?.trim() || null,
        // Added to the watchlist; for the ratings, when it was rated — the
        // closest the file has to "when it joined the library".
        addedAt: parseDateOrNull(row.Created?.trim() || row["Date Rated"]),
      };

      if (kind === "movie") {
        mergeMovie(movies, {
          ...fields,
          year: parseYear(row.Year),
          watched,
          // `Date Rated` is when the rating was typed, not when the film was
          // seen: someone rating a back catalogue in one sitting would have
          // every one of those films land on the same day.
          watchedAt: null,
          rewatchedAt: [],
          externalIds: { imdb: imdbId },
        });
      } else if (kind === "series") {
        mergeShow(shows, {
          ...fields,
          externalIds: { imdb: imdbId },
          // The export says nothing about which episodes were seen, so there
          // is no progress, and rating a series is not finishing it.
          episodes: [],
          status: watched ? "WATCHING" : "PLANNED",
        });
      }

      // Everything else IMDb tracks — video games, podcasts, music videos —
      // has no home in this domain and is dropped rather than half-imported.
    }
  }

  return {
    movies: [...movies.values()],
    shows: [...shows.values()],
    ratedEpisodes: [...episodes.values()],
    lists,
  };
}

/**
 * The Loomkeep list a `Position` file becomes, or null for the watchlist.
 *
 * IMDb exports the watchlist and each list with the same columns, so only the
 * file name can tell them apart: one that mentions "watchlist" is the
 * watchlist, any other names its list. A payload sent without names (a single
 * CSV) keeps the old reading: watchlist.
 */
function customListName(fileName: string | null): string | null {
  if (fileName === null) return null;
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.csv$/i, "");
  if (/watchlist/i.test(base)) return null;
  return base.trim() || null;
}

function parseList(name: string, rows: Record<string, string>[]): ImportList {
  const items: ImportListFilm[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const imdbId = row.Const?.trim() ?? "";
    const title = row.Title?.trim() || row["Original Title"]?.trim();
    const kind = titleKind(row["Title Type"]);
    // A list item is a work: episodes and other title types have no place in
    // a Loomkeep list.
    if (!IMDB_ID.test(imdbId) || !title || seen.has(imdbId)) continue;
    if (kind !== "movie" && kind !== "series") continue;

    seen.add(imdbId);
    items.push({
      title,
      year: parseYear(row.Year),
      externalIds: { imdb: imdbId },
      type: kind === "series" ? "SERIES" : "MOVIE",
      note: row.Description?.trim() || null,
    });
  }

  return { name, description: null, items };
}

/**
 * The same title can be in the ratings and on the watchlist: one entry,
 * watched if either file says so, keeping whichever rating, note and earliest
 * date is known.
 */
function mergeMovie(
  movies: Map<string, ImportMovie>,
  movie: ImportMovie & { externalIds: { imdb: string } },
): void {
  const existing = movies.get(movie.externalIds.imdb);

  if (!existing) {
    movies.set(movie.externalIds.imdb, movie);
    return;
  }

  existing.watched ||= movie.watched;
  existing.rating ??= movie.rating;
  existing.notes ??= movie.notes;
  existing.addedAt = earliest(existing.addedAt, movie.addedAt);
}

function mergeShow(
  shows: Map<string, ImportShow>,
  show: ImportShow & { externalIds: { imdb: string } },
): void {
  const existing = shows.get(show.externalIds.imdb);

  if (!existing) {
    shows.set(show.externalIds.imdb, show);
    return;
  }

  if (show.status === "WATCHING") existing.status = "WATCHING";
  existing.rating ??= show.rating;
  existing.notes ??= show.notes;
  existing.addedAt = earliest(existing.addedAt, show.addedAt);
}

function mergeEpisode(
  episodes: Map<string, ImdbRatedEpisode>,
  episode: ImdbRatedEpisode,
): void {
  const existing = episodes.get(episode.imdbId);
  if (existing) existing.rating ??= episode.rating;
  else episodes.set(episode.imdbId, episode);
}

function earliest(
  a: Date | null | undefined,
  b: Date | null | undefined,
): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a < b ? a : b;
}

function titleKind(raw: string | undefined): TitleKind | null {
  const key = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return TITLE_KINDS[key] ?? null;
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

/** IMDb already rates out of 10, which is Loomkeep's own scale. */
function parseRating(raw: string | undefined): number | null {
  const rating = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) return null;
  return rating;
}
