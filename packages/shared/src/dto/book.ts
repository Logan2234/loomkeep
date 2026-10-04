import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  SessionCycleAction,
  SessionSource,
  TrackingCycleStatus,
} from "../enums";
import type { RatingDto } from "./catalog";
import type { SessionWeekDayDto } from "./session";

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
  /**
   * 18+ title. Restricted per-account like media, but Open Library carries no
   * maturity rating, so it is always false today — the plumbing stays in place
   * for the day a source exposes one.
   */
  isAdult: boolean;
}

export interface BookSearchResponseDto {
  results: BookSummaryDto[];
}

/**
 * One edition of a work, offered by the manual edition selector on the book
 * detail page. `key` is opaque — pass it back as `edition` on the detail
 * endpoint to view that edition instead of the language-auto-picked one.
 */
export interface BookEditionDto {
  key: string;
  title: string;
  /** Human-readable language, when known. */
  language: string | null;
  coverUrl: string | null;
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
  /** Source edition used for edition-specific pagination and cover data. */
  editionKey: string | null;
  /** ISO first-publication date; null when the source has none. */
  releaseDate: string | null;
  /** Permalink to the work's Open Library page, when known. */
  website: string | null;
  /** Other books by the primary author — stands in for "similar titles". */
  sameAuthorBooks: BookSummaryDto[];
  /** Open Library's own average rating, when known. */
  ratings: RatingDto[];
  /** Number of editions Open Library has catalogued for the work. */
  editionCount: number | null;
  /** ISBN of the picked edition (English when available), when known. */
  isbn: string | null;
  series: string | null;
  /** The Open Library series it's a numbered volume of, for its saga. */
  seriesKey: string | null;
  /** Human-readable language of the picked edition, when known. */
  language: string | null;
  firstSentence: string | null;
  /** Free full-text scan on the Internet Archive, when Open Library links one. */
  readOnlineUrl: string | null;
  /** Cross-reference links (Goodreads, LibraryThing, Amazon…), when known. */
  externalLinks: { label: string; url: string }[];
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

export interface BookReadingDto {
  id: string;
  number: number;
  status: TrackingCycleStatus;
  editionKey: string | null;
  referencePageCount: number | null;
  currentPage: number;
  startedAt: string | null;
  finishedAt: string | null;
  sessionCount: number;
  trackedMinutes: number;
  pagesRead: number;
  /** True when migrated history only supplied a completion date. */
  legacyIncomplete: boolean;
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
  /** Edition used as the reference for page progress. */
  editionKey: string | null;
  referencePageCount: number | null;
  /** Sum of dated reading sessions recorded in Loomkeep. */
  trackedReadingMinutes: number;
  /** Latest dated reading session, used for the derived paused signal. */
  lastSessionAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** When the entry was added to the library (ISO). */
  createdAt: string;
  /** Reading history, current one first. */
  readings: BookReadingDto[];
  /** How the user holds this book, if set (NONE = unset). */
  ownershipStatus: BookOwnershipStatus;
  /** Free-form detail for DIGITAL/AUDIO (e.g. "Kindle"); null otherwise. */
  ownershipSource: string | null;
}

/** Body for creating/updating a library entry from a catalogue book. */
export interface UpsertBookEntryDto {
  source: BookSource;
  sourceId: string;
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  editionKey?: string | null;
  referencePageCount?: number | null;
}

/** Body for patching an existing book library entry. */
export interface UpdateBookEntryDto {
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  /** Current reading position, in pages. */
  currentPage?: number;
  editionKey?: string | null;
  referencePageCount?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  ownershipStatus?: BookOwnershipStatus;
  ownershipSource?: string | null;
}

export interface BookSessionDto {
  id: string;
  readingId: string | null;
  readingNumber: number | null;
  durationMinutes: number;
  pagesRead: number;
  startPage: number | null;
  endPage: number | null;
  notes: string | null;
  occurredAt: string;
  source: SessionSource;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookSessionDto {
  durationMinutes: number;
  occurredAt: string;
  notes?: string | null;
  cycleAction?: SessionCycleAction;
  /** Quantity mode. Mutually exclusive with startPage/endPage. */
  pagesRead?: number;
  /** Range mode. Both values are required together. */
  startPage?: number;
  endPage?: number;
}

export interface UpdateBookSessionDto {
  durationMinutes?: number;
  occurredAt?: string;
  notes?: string | null;
  pagesRead?: number;
  startPage?: number | null;
  endPage?: number | null;
}

export interface BookSessionSummaryDto {
  items: BookSessionDto[];
  hasMore: boolean;
  totalSessions: number;
  totalTrackedMinutes: number;
  totalPagesRead: number;
  weekMinutes: number;
  weekSessions: number;
  weekDays: SessionWeekDayDto[];
  monthMinutes: number;
  averagePagesPerDay: number | null;
  estimatedCompletionDate: string | null;
  completionSuggested: boolean;
  activeReading: BookReadingDto | null;
}

export interface BookSessionMutationDto {
  session: BookSessionDto;
  summary: BookSessionSummaryDto;
  xpAwarded: boolean;
}

/**
 * Everything the book detail page needs in one call: catalogue metadata
 * (cached if persisted, else fetched live) + the current user's library state.
 * `entry` is null when the book is not in the library.
 */
export interface BookDetailDto extends BookDetailsDto {
  /** Cached work id when a public discussion can exist; null for a live-only item. */
  commentTargetId: string | null;
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
