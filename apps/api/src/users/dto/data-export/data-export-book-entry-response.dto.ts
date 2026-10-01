import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  DataExportBookEntry,
  SessionSource,
} from "@loomkeep/shared";

class DataExportBookExternalIdResponseDto {
  /**
   * The catalogue or service the id belongs to.
   * @example "OPEN_LIBRARY"
   */
  source!: string;

  /**
   * The id there.
   * @example "OL893415W"
   */
  externalId!: string;
}

class DataExportBookEntryBookResponseDto {
  /**
   * The book's title.
   * @example "Dune"
   */
  title!: string;

  /**
   * Its authors.
   * @example ["Frank Herbert"]
   */
  authors!: string[];

  /**
   * The catalogue Loomkeep reads it from.
   * @example "OPEN_LIBRARY"
   */
  canonicalSource!: BookSource;

  /**
   * Its id in that catalogue.
   * @example "OL893415W"
   */
  sourceId!: string;

  /** Its ids in the catalogue. */
  externalIds!: DataExportBookExternalIdResponseDto[];
}

class DataExportBookSessionResponseDto {
  /**
   * The reading it belongs to, 1 for the first; null outside one.
   * @example 1
   */
  readingNumber!: number | null;

  /**
   * Length of the session, in minutes.
   * @example 45
   */
  durationMinutes!: number;

  /**
   * Pages read during the session.
   * @example 20
   */
  pagesRead!: number;

  /**
   * First page, when given.
   * @example 100
   */
  startPage!: number | null;

  /**
   * Last page, when given.
   * @example 120
   */
  endPage!: number | null;

  /**
   * Notes on the session.
   * @example "Finally beat the second boss"
   */
  notes!: string | null;

  /**
   * When the session happened.
   * @example "2026-09-30T21:00:00.000Z"
   */
  occurredAt!: string;

  /**
   * How it was logged: MANUAL, TIMER or IMPORT.
   * @example "TIMER"
   */
  source!: SessionSource;

  /**
   * When it was logged.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}

export class DataExportBookEntryResponseDto implements DataExportBookEntry {
  /** The book. */
  book!: DataExportBookEntryBookResponseDto;

  /**
   * Its status.
   * @example "READING"
   */
  status!: BookStatus;

  /**
   * The account's rating, 0 to 10 with half points.
   * @example 8.5
   */
  rating!: number | null;

  /**
   * Private notes on the entry.
   * @example "Lent by Max"
   */
  notes!: string | null;

  /**
   * Marked as a favourite.
   * @example true
   */
  favorite!: boolean;

  /**
   * Current page.
   * @example 120
   */
  currentPage!: number;

  /**
   * The edition being read, in Open Library.
   * @example "OL7353617M"
   */
  editionKey!: string | null;

  /**
   * Page count of that edition.
   * @example 604
   */
  referencePageCount!: number | null;

  /**
   * Reading time logged in sessions, in minutes.
   * @example 610
   */
  trackedReadingMinutes!: number;

  /**
   * How the book is held.
   * @example "PHYSICAL"
   */
  ownershipStatus!: BookOwnershipStatus;

  /**
   * Where, for a digital copy.
   * @example "Kobo"
   */
  ownershipSource!: string | null;

  /**
   * When it was started.
   * @example "2026-08-02T20:15:00.000Z"
   */
  startedAt!: string | null;

  /**
   * When it was finished.
   * @example "2026-08-30T22:40:00.000Z"
   */
  finishedAt!: string | null;

  /**
   * When it was added to the library.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When each later reading was finished.
   * @example ["2025-12-20T21:00:00.000Z"]
   */
  replays!: string[];

  /** Reading sessions, oldest first. */
  sessions!: DataExportBookSessionResponseDto[];
}
