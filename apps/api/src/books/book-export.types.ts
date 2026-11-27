import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  SessionSource,
  TrackingCycleStatus,
} from "@loomkeep/shared/enums";

// What the account export (`GET /users/me/export`) holds for each book entry.

export interface DataExportBookEntry {
  book: {
    title: string;
    authors: string[];
    canonicalSource: BookSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  currentPage: number;
  editionKey: string | null;
  referencePageCount: number | null;
  trackedReadingMinutes: number;
  ownershipStatus: BookOwnershipStatus;
  ownershipSource: string | null;
  lentOut: boolean;
  loanPerson: string | null;
  loanSince: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed rereads beyond the first, oldest first. */
  replays: string[];
  /** Every reading, the first and the unfinished ones included. */
  readings: {
    number: number;
    status: TrackingCycleStatus;
    editionKey: string | null;
    referencePageCount: number | null;
    currentPage: number;
    pagesRead: number;
    trackedMinutes: number;
    startedAt: string | null;
    finishedAt: string | null;
  }[];
  sessions: {
    readingNumber: number | null;
    durationMinutes: number;
    pagesRead: number;
    startPage: number | null;
    endPage: number | null;
    notes: string | null;
    occurredAt: string;
    source: SessionSource;
    createdAt: string;
  }[];
}
