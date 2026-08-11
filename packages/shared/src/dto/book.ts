import type { BookOwnershipStatus, BookSource, BookStatus } from "../enums";
import type { RatingDto } from "./catalog";

/** A book as returned by a live catalogue search (not persisted). */
export interface BookSummaryDto {
  source: BookSource;
  sourceId: string;
  title: string;
  /** Author names, when known. */
  authors: string[];
  /** First publication year, when known. */
  year: number | null;
  coverUrl: string | null;
  /** 18+ title (Google Books "MATURE"). Restricted per-account, like media. */
  isAdult: boolean;
}

export interface BookSearchResponseDto {
  results: BookSummaryDto[];
}

/** Full book details, fetched live from the source. */
export interface BookDetailsDto extends BookSummaryDto {
  overview: string | null;
  subtitle: string | null;
  publisher: string | null;
  /** Subjects/genres the source tags the book with. */
  genres: string[];
  /** Number of pages, when known. */
  pageCount: number | null;
  /** ISO first-publication date; null when the source has none. */
  releaseDate: string | null;
  /** Permalink to the volume's Google Books page, when known. */
  website: string | null;
  /** Other books by the primary author — stands in for "similar titles". */
  sameAuthorBooks: BookSummaryDto[];
  /** Google Books' own average rating, when known. */
  ratings: RatingDto[];
}

/** A persisted book referenced by at least one user (on-demand cache). */
export interface BookItemDto {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  canonicalSource: BookSource;
  /** External ID in `canonicalSource`, used to address the book detail page. */
  sourceId: string;
}

/** One completed reread, beyond the entry's own (first) completion. */
export interface BookReplayDto {
  id: string;
  /** ISO date the reread was completed. */
  finishedAt: string;
}

export interface BookEntryDto {
  id: string;
  book: BookItemDto;
  status: BookStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  /** Current reading position, in pages (0 = not started). */
  currentPage: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** When the entry was added to the library (ISO). */
  createdAt: string;
  /** Completed rereads beyond the first, most recent first. */
  replays: BookReplayDto[];
  /** How the user holds this book, if set (NONE = unset). */
  ownershipStatus: BookOwnershipStatus;
  /** Free-form detail for DIGITAL/AUDIO (e.g. "Kindle"); null otherwise. */
  ownershipSource: string | null;
}

/** Body for logging a completed reread. */
export interface AddBookReplayDto {
  /** ISO date; defaults to now. */
  finishedAt?: string;
}

/** Body for creating/updating a library entry from a catalogue book. */
export interface UpsertBookEntryDto {
  source: BookSource;
  sourceId: string;
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
}

/** Body for patching an existing book library entry. */
export interface UpdateBookEntryDto {
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  /** Current reading position, in pages. */
  currentPage?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  ownershipStatus?: BookOwnershipStatus;
  ownershipSource?: string | null;
}

/**
 * Everything the book detail page needs in one call: catalogue metadata
 * (cached if persisted, else fetched live) + the current user's library state.
 * `entry` is null when the book is not in the library.
 */
export interface BookDetailDto extends BookDetailsDto {
  entry: BookEntryDto | null;
}

/** A user's yearly reading target and their progress towards it. */
export interface ReadingGoalDto {
  year: number;
  target: number;
  /** Books finished during `year`, counting rereads. */
  completed: number;
}

/** Body for setting/updating the reading goal for a given year. */
export interface UpsertReadingGoalDto {
  year: number;
  target: number;
}
