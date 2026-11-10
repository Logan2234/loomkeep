import type {
  CreatorSeriesRefDto,
  CreatorWorkDto,
  PersonPageDto,
} from "@loomkeep/shared";
import {
  CreatorCreditKind,
  CreatorGroupKey,
  CreatorSource,
  Domain,
} from "@loomkeep/shared";
import { coverUrl, description } from "./open-library.format";

/** `/authors/{id}.json`, the fields an author page reads. */
export interface OpenLibraryAuthor {
  name?: string;
  personal_name?: string;
  alternate_names?: string[];
  bio?: string | { value?: string };
  birth_date?: string; // Free text: "28 April 1948", "7 Jun 1957", "1929".
  death_date?: string;
  photos?: number[];
  remote_ids?: { wikidata?: string; imdb?: string };
}

/** One of the author's works from `/search.json`. */
export interface OpenLibraryAuthorWork {
  key: string; // "/works/OL893414W".
  title?: string;
  author_key?: string[];
  first_publish_year?: number;
  edition_count?: number;
  cover_i?: number;
  series_key?: string[];
  series_name?: string[];
  series_position?: string[];
  // The edition Solr's `lang=` ranked first: in the viewer's language only
  // when one exists, any other language otherwise.
  editions?: { docs?: { title?: string; language?: string[] }[] };
}

// Measured on Le Guin, King, Pratchett and Vargas (2026-11): half or more of
// an author's Open Library works have a single edition (stray translations,
// reprints, bad merges). These keep the books people know.
const KNOWN_EDITIONS = 3;
// A new book hasn't had time to be republished.
const RECENT_YEARS = 5;
// Below this many known books, everything is shown: a writer with two
// books, each in one edition, still has a page.
const FEW_WORKS = 8;
// Past three names, a book whose first author is someone else is a
// collection they contributed to. A novel credited with its illustrators
// still lists its author first.
const MAX_COAUTHORS = 3;
// Box sets and omnibuses: "Novels (Carrie / Salem's Lot)", "It [1/2]",
// "The Colour of Magic / The Light Fantastic", "Coffret"…
const OMNIBUS =
  /\[\d+\/\d+\]|\(.*\/.*\)|\s\/\s|^(novels|works|short stories|collected works|complete works|omnibus)\b|\b(box(ed)? set|trilogy|coffret|intégrale)\b/i;
const WHOLE_NUMBER = /^\d+$/;
const PHOTOS_URL = "https://covers.openlibrary.org/a/id";

export function toAuthorPage(
  id: string,
  author: OpenLibraryAuthor,
  docs: OpenLibraryAuthorWork[],
  lang: string,
  currentYear: number,
): PersonPageDto {
  const books: CreatorWorkDto[] = [];
  const collections: CreatorWorkDto[] = [];
  let rareCount = 0;

  for (const doc of docs) {
    const authors = doc.author_key ?? [];
    const anthology = authors.length > MAX_COAUTHORS && authors[0] !== id;
    const omnibus = OMNIBUS.test(doc.title ?? "");

    if (anthology || omnibus) {
      // One-off compilations are the noisiest of all.
      if ((doc.edition_count ?? 0) < 2) rareCount++;
      else {
        collections.push(
          toWork(
            doc,
            lang,
            currentYear,
            anthology ? CreatorCreditKind.ANTHOLOGY : CreatorCreditKind.OMNIBUS,
          ),
        );
      }

      continue;
    }

    books.push(toWork(doc, lang, currentYear, CreatorCreditKind.WORK));
  }

  // The same book catalogued twice: the more published record stays.
  const byTitle = new Map<string, CreatorWorkDto>();

  for (const book of books) {
    const key = normalizedTitle(book.title) || book.sourceId;
    const held = byTitle.get(key);

    if (held && (held.editionCount ?? 0) >= (book.editionCount ?? 0)) {
      rareCount++;
      continue;
    }

    if (held) rareCount++;
    byTitle.set(key, book);
  }

  const distinct = [...byTitle.values()];
  const known = distinct.filter(
    (book) =>
      (book.editionCount ?? 0) >= KNOWN_EDITIONS ||
      (book.year ?? 0) > currentYear - RECENT_YEARS,
  );
  const shown = known.length < FEW_WORKS ? distinct : known;
  rareCount += distinct.length - shown.length;

  const birthday = authorDate(author.birth_date);
  const name = author.name ?? author.personal_name ?? id;
  const photo = author.photos?.find((photoId) => photoId > 0);

  return {
    source: CreatorSource.OPEN_LIBRARY,
    id,
    name,
    photoUrl: photo ? `${PHOTOS_URL}/${photo}-L.jpg` : null,
    description: description(author.bio),
    birthday,
    deathday: authorDate(author.death_date),
    placeOfBirth: null,
    knownFor: CreatorGroupKey.WRITING,
    alsoKnownAs: [...new Set(author.alternate_names ?? [])].filter(
      (alias) => alias !== name,
    ),
    imdbId: author.remote_ids?.imdb ?? null,
    wikidataId: author.remote_ids?.wikidata ?? null,
    homepage: null,
    groups:
      shown.length + collections.length > 0
        ? [
            {
              key: CreatorGroupKey.WRITING,
              works: [...shown, ...collections].sort(byYear),
            },
          ]
        : [],
    rareCount,
  };
}

function toWork(
  doc: OpenLibraryAuthorWork,
  lang: string,
  currentYear: number,
  kind: CreatorCreditKind,
): CreatorWorkDto {
  const year = doc.first_publish_year ?? null;
  const edition = doc.editions?.docs?.[0];
  const translated =
    edition?.title && edition.language?.some((code) => sameLanguage(code, lang))
      ? editionTitle(edition.title)
      : null;

  return {
    domain: Domain.BOOKS,
    type: null,
    sourceId: doc.key.replace("/works/", ""),
    title: translated ?? doc.title ?? doc.key,
    year,
    releaseDate: null,
    posterUrl: coverUrl(doc.cover_i),
    isAdult: false,
    jobs: [],
    character: null,
    episodeCount: null,
    genreIds: [],
    upcoming: year !== null && year > currentYear,
    kind,
    editionCount: doc.edition_count ?? 0,
    series: seriesOf(doc),
    status: null,
  };
}

/** The first series the work has a whole-number place in ("2.5" is a novella). */
function seriesOf(doc: OpenLibraryAuthorWork): CreatorSeriesRefDto | null {
  const keys = doc.series_key ?? [];

  for (const [index, key] of keys.entries()) {
    const position = doc.series_position?.[index];
    if (!position || !WHOLE_NUMBER.test(position)) continue;
    return {
      key,
      name: doc.series_name?.[index] ?? key,
      position: Number(position),
    };
  }

  return null;
}

// "Les Annales du Disque-monde. Tome VII. Pyramides",
// "Les annales du Disque-monde. [10], Les zinzins d'Olive-Oued": an edition's
// title often leads with its collection and volume.
const VOLUME_PREFIX =
  /^.+?[.,:]\s*(?:tome|t\.|vol\.?|volume|numéro|n°)?\s*\[?[\dIVXLC]+\]?\s*[.,:]\s*(.+)$/i;

/** An edition's title without its collection prefix or "(French Edition)". */
export function editionTitle(title: string): string {
  const bare = title.replace(/\s*\((?:\w+ )?edition\)$/i, "").trim();
  const match = VOLUME_PREFIX.exec(bare);
  return match ? match[1].trim() : bare;
}

/** Oldest first; undated last, like the other person pages. */
function byYear(a: CreatorWorkDto, b: CreatorWorkDto): number {
  if (a.year === b.year) return a.title.localeCompare(b.title);
  if (a.year === null) return 1;
  if (b.year === null) return -1;
  return a.year - b.year;
}

/** "The Stand", "Stand (The)", "THE STAND: Complete" all read "stand". */
function normalizedTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .split(/[:;]/)[0]
    .trim()
    .replace(/^(the|a|an|le|la|les|l'|il|lo|gli|i)\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Open Library's MARC codes ("fre", "ger") against the app's ("fr", "de"):
// Intl names both the same.
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

function sameLanguage(marcCode: string, lang: string): boolean {
  try {
    return languageNames.of(marcCode) === languageNames.of(lang);
  } catch {
    return false;
  }
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/**
 * "28 April 1948" or "April 28, 1948" → "1948-04-28"; "1948" stays a bare
 * year. Anything else is dropped rather than guessed.
 */
export function authorDate(raw: string | undefined): string | null {
  const text = raw?.trim() ?? "";
  if (/^\d{4}$/.test(text)) return text;

  const dayFirst = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i.exec(text);
  const monthFirst = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text);
  const [day, month, year] = dayFirst
    ? [dayFirst[1], dayFirst[2], dayFirst[3]]
    : monthFirst
      ? [monthFirst[2], monthFirst[1], monthFirst[3]]
      : [];
  const monthIndex = MONTHS.indexOf(month?.slice(0, 3).toLowerCase() ?? "");
  if (!day || !year || monthIndex < 0) return null;

  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}
