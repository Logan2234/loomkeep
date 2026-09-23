import { parseCsv } from "../../csv";
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
    const entry = film(name, parseYear(row.Year));
    entry.addedAt = parseDate(row.Date);
  }

  for (const row of rowsOf(entries, LETTERBOXD_FILES.watched)) {
    const name = row.Name?.trim();
    if (!name) continue;
    const entry = film(name, parseYear(row.Year));
    entry.watched = true;
    // `Date` here is when the film was marked watched, which for a bulk
    // "mark all as watched" is the day of the click — never a viewing date.
    entry.addedAt ??= parseDate(row.Date);
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
        watchedAt: parseDate(row["Watched Date"]),
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
    const entry = film(name, parseYear(row.Year));
    const rating = parseRating(row.Rating);

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

  for (const title of favoriteFilms(entries)) {
    for (const entry of byKey.values()) {
      if (entry.title.toLowerCase() === title) entry.favorite = true;
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
 * The (up to four) films pinned on the profile, lowercased. Letterboxd's own
 * "like" (the heart) is deliberately ignored: an active member likes hundreds
 * of films, which would make the notion of a favourite meaningless here.
 */
function favoriteFilms(entries: Map<string, string>): string[] {
  const rows = rowsOf(entries, LETTERBOXD_FILES.profile);
  const raw = rows[0]?.["Favorite Films"];
  if (!raw) return [];
  return raw
    .split(",")
    .map((title) => title.trim().toLowerCase())
    .filter((title) => title.length > 0);
}

/**
 * Each `lists/*.csv` holds a metadata block (the list's own name, description
 * and a `Ranked List` flag), a blank line, then the films under a second
 * header. `parseCsv` keys on the first header row, so the two blocks are split
 * apart before parsing.
 */
function parseLists(entries: Map<string, string>): ImportList[] {
  const lists: ImportList[] = [];

  for (const [path, text] of entries) {
    if (!path.includes("/lists/") && !path.startsWith("lists/")) continue;

    const blocks = splitBlocks(text);
    if (blocks.length === 0) continue;

    // The items block is the one with a `Name` column; the metadata block
    // carries the list's own name in the same column, hence "last wins".
    const itemsBlock = blocks[blocks.length - 1];
    const metaBlock = blocks.length > 1 ? blocks[0] : null;
    const meta = metaBlock ? parseCsv(metaBlock)[0] : undefined;

    const items: ImportListFilm[] = [];

    for (const row of parseCsv(itemsBlock)) {
      const name = row.Name?.trim();
      if (!name) continue;
      items.push({ title: name, year: parseYear(row.Year), externalIds: {} });
    }

    if (items.length === 0) continue;

    lists.push({
      name: meta?.Name?.trim() || listNameFromPath(path),
      description: meta?.Description?.trim() || null,
      ranked: isTrue(meta?.["Ranked List"]),
      items,
    });
  }

  return lists;
}

/** Splits a list CSV on its blank separator line. */
function splitBlocks(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
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

function parseDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const date = new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Letterboxd stars (0.5–5, half steps) on Loomkeep's 0–10 scale. */
function parseRating(raw: string | undefined): number | null {
  const stars = Number.parseFloat(raw ?? "");
  if (!Number.isFinite(stars) || stars <= 0) return null;
  return Math.min(10, stars * 2);
}

function isTrue(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "yes" || raw?.trim() === "true";
}
