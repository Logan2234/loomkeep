import type { BookStatus, Domain, EntryStatus, MediaType } from "../enums";

/**
 * Catalogue a creator page reads from, as it appears in the page's URL
 * (`/app/people/tmdb/137427`). One closed list spanning every domain: a
 * person can be a TMDB or AniList staff member or an Open Library author.
 */
export const CreatorSource = {
  TMDB: "tmdb",
  ANILIST: "anilist",
  IGDB: "igdb",
  OPEN_LIBRARY: "openlibrary",
} as const;

export type CreatorSource = (typeof CreatorSource)[keyof typeof CreatorSource];

/**
 * A person, studio or franchise credited on a work, with what it takes to
 * link to its page. Whether it is a person or a studio follows from the
 * field holding it (`directorRefs`, `studioRefs`…).
 */
export interface CreatorRefDto {
  source: CreatorSource;
  /** The creator's id in `source`. */
  id: string;
  name: string;
}

/** One role group on a creator page ("Directing", "Acting"…). */
export const CreatorGroupKey = {
  DIRECTING: "DIRECTING",
  WRITING: "WRITING",
  PRODUCTION: "PRODUCTION",
  SOUND: "SOUND",
  CAMERA: "CAMERA",
  EDITING: "EDITING",
  ART: "ART",
  CREW: "CREW",
  ACTING: "ACTING",
} as const;

export type CreatorGroupKey =
  (typeof CreatorGroupKey)[keyof typeof CreatorGroupKey];

/**
 * What a credit amounts to. A page lists `WORK` and `SHORT` credits as the
 * person's works; the others are appearances and mentions, listed apart so
 * they don't bury them.
 */
export const CreatorCreditKind = {
  WORK: "WORK",
  /** A film of 40 minutes or less. */
  SHORT: "SHORT",
  /** On a series as oneself: talk show, ceremony, reality show. */
  TV_APPEARANCE: "TV_APPEARANCE",
  /** In a documentary film as oneself (making-of, portrait). */
  DOCUMENTARY: "DOCUMENTARY",
  /** In a fiction film as oneself. */
  CAMEO: "CAMEO",
  /** Thanked in the credits, with no other job in the group. */
  THANKS: "THANKS",
  /** A book gathering several authors, edited by someone else. */
  ANTHOLOGY: "ANTHOLOGY",
  /** Several of the author's books in one volume or box set. */
  OMNIBUS: "OMNIBUS",
} as const;

export type CreatorCreditKind =
  (typeof CreatorCreditKind)[keyof typeof CreatorCreditKind];

/**
 * One work in a creator's group, with every job they hold on it within that
 * group ("Screenplay" and "Story" both sit under Writing).
 */
export interface CreatorWorkDto {
  /** MEDIA for a TMDB person's works, BOOKS for an author's. */
  domain: Extract<Domain, "MEDIA" | "BOOKS">;
  /** MOVIE or SERIES for a TMDB person; null for a book. */
  type: MediaType | null;
  sourceId: string;
  title: string;
  year: number | null;
  /** Release or first air date ("2021-09-15"), when known. */
  releaseDate: string | null;
  posterUrl: string | null;
  isAdult: boolean;
  /** Crew jobs held on the work ("Director", "Screenplay"); empty for acting. */
  jobs: string[];
  /** Character played, for acting; "Self" for an appearance as oneself. */
  character: string | null;
  /** Episodes credited on a series, when the source counts them. */
  episodeCount: number | null;
  /** The source's genre ids (TMDB: 99 is documentary). */
  genreIds: number[];
  /** Not released yet. */
  upcoming: boolean;
  kind: CreatorCreditKind;
  /** How many editions a book has: how widely it was published. Null for a film or series. */
  editionCount: number | null;
  /** The book's series and its place in it, when the source knows one. */
  series: CreatorSeriesRefDto | null;
  /** The viewer's status for the work; null when it's not in their library. */
  status: EntryStatus | BookStatus | null;
}

export interface CreatorSeriesRefDto {
  key: string;
  name: string;
  /** Whole-number place in the series. */
  position: number;
}

export interface CreatorGroupDto {
  key: CreatorGroupKey;
  /** Oldest first; undated works last. */
  works: CreatorWorkDto[];
}

/** A person's page: identity, then their works grouped by role. */
export interface PersonPageDto {
  source: CreatorSource;
  id: string;
  name: string;
  photoUrl: string | null;
  /** Biography in the viewer's language when the source has it. */
  description: string | null;
  /** ISO date of birth, or just its year ("1948") when that's all the source knows. */
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  /** The group the source says they're best known for. */
  knownFor: CreatorGroupKey | null;
  /** Other spellings and transliterations of the name. */
  alsoKnownAs: string[];
  imdbId: string | null;
  wikidataId: string | null;
  homepage: string | null;
  /** The `knownFor` group first, then the one with the most works (appearances and mentions left out). */
  groups: CreatorGroupDto[];
  /** Books left out for having too few editions, counted to point at the source. 0 for a TMDB person. */
  rareCount: number;
}
