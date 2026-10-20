import { parseCsv, parseCsvRows } from "../../../common/csv.util";
import { parseDateOrNull } from "../../import-date.util";
import type {
  ImportList,
  ImportListFilm,
  ImportMovie,
} from "../../media-import-model";

/**
 * Letterboxd's data export (a ZIP of CSVs), reduced to films.
 *
 * Two things shape everything here:
 *
 * - **No identifiers.** The export carries only `Name`, `Year` and a
 *   `boxd.it` short link. Letterboxd knows the TMDB id internally but does not
 *   export it, and resolving the link would mean scraping their site, so
 *   matching goes through title + year and the wizard's manual review.
 * - **Ratings live in two places.** `ratings.csv` holds the film's current
 *   rating; `diary.csv` holds the rating as it was for each viewing. The
 *   former wins — it is what the profile shows today.
 *
 * Letterboxd is films only, so `shows` stays empty.
 */

/** Paths inside the archive, matched as suffixes (see `readZipEntriesByPath`). */
export const LETTERBOXD_FILES = {
  diary: "diary.csv",
  ratings: "ratings.csv",
  watched: "watched.csv",
  watchlist: "watchlist.csv",
  reviews: "reviews.csv",
  profile: "profile.csv",
} as const;

export interface LetterboxdExport {
  movies: ImportMovie[];
  lists: ImportList[];
}

/** One diary/review row, already narrowed to what a film entry needs. */
interface Viewing {
  watchedAt: Date | null;
  rating: number | null;
  review: string | null;
}

/**
 * `entries` maps an archive path to its CSV text: every `lists/*.csv` plus
 * whichever of {@link LETTERBOXD_FILES} the export contains.
 */
export function parseLetterboxdExport(
  entries: Map<string, string>,
): LetterboxdExport {
  const byKey = new Map<string, ImportMovie>();
  const viewingsByKey = new Map<string, Viewing[]>();
  // The film's own `boxd.it` link, as watched/ratings/watchlist carry it —
  // the diary's points at the diary entry instead, so it is left out.
  const keyByLink = new Map<string, string>();

  const linkTo = (row: Record<string, string>, key: string) => {
    const link = normalizeLink(row["Letterboxd URI"]);
    if (link) keyByLink.set(link, key);
  };

  const film = (name: string, year: number | null): ImportMovie => {
    const key = filmKey(name, year);
    const existing = byKey.get(key);
    if (existing) return existing;

    const created: ImportMovie = {
      title: name,
      year,
      watched: false,
      watchedAt: null,
      rewatchedAt: [],
      externalIds: {},
    };
    byKey.set(key, created);
    return created;
  };

  // watchlist.csv first: anything appearing later as watched overrides it.
  for (const row of rowsOf(entries, LETTERBOXD_FILES.watchlist)) {
    const name = row.Name?.trim();
    if (!name) continue;
    const year = parseYear(row.Year);
    const entry = film(name, year);
    entry.addedAt = parseDateOrNull(row.Date);
    linkTo(row, filmKey(name, year));
  }

  for (const row of rowsOf(entries, LETTERBOXD_FILES.watched)) {
    const name = row.Name?.trim();
    if (!name) continue;
    const year = parseYear(row.Year);
    const entry = film(name, year);
    entry.watched = true;
    // `Date` here is when the film was marked watched, which for a bulk
    // "mark all as watched" is the day of the click — never a viewing date.
    entry.addedAt ??= parseDateOrNull(row.Date);
    linkTo(row, filmKey(name, year));
  }

  // diary.csv and reviews.csv both describe viewings; reviews.csv is a subset
  // of the diary carrying the text, so it is folded in on the same key.
  for (const file of [LETTERBOXD_FILES.diary, LETTERBOXD_FILES.reviews]) {
    for (const row of rowsOf(entries, file)) {
      const name = row.Name?.trim();
      if (!name) continue;
      const year = parseYear(row.Year);
      const entry = film(name, year);
      entry.watched = true;

      const key = filmKey(name, year);
      const viewings = viewingsByKey.get(key) ?? [];
      viewings.push({
        watchedAt: parseDateOrNull(row["Watched Date"]),
        rating: parseRating(row.Rating),
        review: row.Review?.trim() || null,
      });
      viewingsByKey.set(key, viewings);
    }
  }

  // ratings.csv is the canonical rating, applied over any diary rating.
  for (const row of rowsOf(entries, LETTERBOXD_FILES.ratings)) {
    const name = row.Name?.trim();
    if (!name) continue;
    const year = parseYear(row.Year);
    const entry = film(name, year);
    const rating = parseRating(row.Rating);
    linkTo(row, filmKey(name, year));

    if (rating !== null) {
      entry.watched = true;
      entry.rating = rating;
    }
  }

  for (const [key, viewings] of viewingsByKey) {
    const entry = byKey.get(key);
    if (!entry) continue;
    applyViewings(entry, viewings);
  }

  for (const favorite of favoriteFilms(entries)) {
    if (favorite.link) {
      const entry = byKey.get(keyByLink.get(favorite.link) ?? "");
      if (entry) entry.favorite = true;
      continue;
    }

    for (const entry of byKey.values()) {
      if (entry.title.toLowerCase() === favorite.title) entry.favorite = true;
    }
  }

  return { movies: [...byKey.values()], lists: parseLists(entries) };
}

/**
 * Folds a film's viewings into the entry: the earliest dated one is the watch,
 * the rest are rewatches. An undated viewing still proves the film was seen,
 * which is why it never becomes a date.
 */
function applyViewings(entry: ImportMovie, viewings: Viewing[]): void {
  const dates = viewings
    .map((v) => v.watchedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length > 0) {
    entry.watchedAt = dates[0];
    entry.rewatchedAt = dates.slice(1);
  }

  // Longest review wins when several viewings carry one — the fullest text is
  // the one worth keeping, and Loomkeep holds a single review per film.
  const review = viewings
    .map((v) => v.review)
    .filter((text): text is string => text !== null)
    .sort((a, b) => b.length - a.length)[0];
  if (review) entry.review = review;

  // Only as a fallback: ratings.csv, applied after this, is authoritative.
  if (entry.rating === null || entry.rating === undefined) {
    const rated = viewings.find((v) => v.rating !== null);
    if (rated) entry.rating = rated.rating;
  }
}

/**
 * The (up to four) films pinned on the profile. Letterboxd's own "like" (the
 * heart) is deliberately ignored: an active member likes hundreds of films,
 * which would make the notion of a favourite meaningless here.
 *
 * `Favorite Films` holds the films' `boxd.it` links, matched against the
 * links the other files carry. Titles (lowercased) are read too, as a
 * fallback for an export that writes those instead.
 */
function favoriteFilms(
  entries: Map<string, string>,
): { link: string | null; title: string }[] {
  const rows = rowsOf(entries, LETTERBOXD_FILES.profile);
  const raw = rows[0]?.["Favorite Films"]?.trim();
  if (!raw) return [];

  const links = raw.match(/https?:\/\/\S+?(?=,|\s|$)/g);

  if (links) {
    return links.map((link) => ({ link: normalizeLink(link), title: "" }));
  }

  return raw
    .split(",")
    .map((title) => ({ link: null, title: title.trim().toLowerCase() }))
    .filter((favorite) => favorite.title.length > 0);
}

/** A `boxd.it` / letterboxd.com link, compared without scheme or slash. */
function normalizeLink(raw: string | undefined): string | null {
  const link = raw
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return link || null;
}

/**
 * Each `lists/*.csv` opens with a version line (`Letterboxd list export v7`),
 * then the list's own row under a `Date,Name,Tags,URL,Description` header, a
 * blank line, and the films under a `Position,Name,Year,URL,Description`
 * header. The rows are read whole — a description can span paragraphs — and
 * each header is found by its columns rather than by line number.
 */
function parseLists(entries: Map<string, string>): ImportList[] {
  const lists: ImportList[] = [];

  for (const [path, text] of entries) {
    if (!path.includes("/lists/") && !path.startsWith("lists/")) continue;

    const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
    const itemsAt = rows.findIndex(
      (row) => row.includes("Name") && row.includes("Year"),
    );
    if (itemsAt === -1) continue;

    const metaAt = rows
      .slice(0, itemsAt)
      .findIndex((row) => row.includes("Name") && row.includes("Date"));
    const meta =
      metaAt === -1 ? undefined : record(rows[metaAt], rows[metaAt + 1]);

    const items: ImportListFilm[] = [];

    for (const cells of rows.slice(itemsAt + 1)) {
      const row = record(rows[itemsAt], cells);
      const name = row.Name?.trim();
      if (!name) continue;
      items.push({
        title: name,
        year: parseYear(row.Year),
        externalIds: {},
        // The note the user wrote on this entry of the list.
        note: row.Description?.trim() || null,
      });
    }

    if (items.length === 0) continue;

    lists.push({
      name: meta?.Name?.trim() || listNameFromPath(path),
      description: meta?.Description?.trim() || null,
      items,
    });
  }

  return lists;
}

function record(
  header: string[],
  cells: string[] | undefined,
): Record<string, string> {
  return Object.fromEntries(header.map((key, i) => [key, cells?.[i] ?? ""]));
}

function listNameFromPath(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.csv$/, "");
}

function rowsOf(
  entries: Map<string, string>,
  file: string,
): Record<string, string>[] {
  for (const [path, text] of entries) {
    if (path === file || path.endsWith(`/${file}`)) return parseCsv(text);
  }

  return [];
}

function filmKey(name: string, year: number | null): string {
  return `${name.toLowerCase()}|${year ?? ""}`;
}

function parseYear(raw: string | undefined): number | null {
  const year = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(year) ? year : null;
}

/** Letterboxd stars (0.5–5, half steps) on Loomkeep's 0–10 scale. */
function parseRating(raw: string | undefined): number | null {
  const stars = Number.parseFloat(raw ?? "");
  if (!Number.isFinite(stars) || stars <= 0) return null;
  return Math.min(10, stars * 2);
}
