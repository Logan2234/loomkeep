import type {
  BookOwnershipStatus,
  BookStatus,
  BulkEntriesTargetDto,
  BulkUpdateEntriesDto,
  CreateBookSessionDto,
  UpdateBookEntryDto,
  UpdateBookSessionDto,
  UpsertBookEntryDto,
  UpsertReadingGoalDto,
} from "@loomkeep/shared";
import { getLocale } from "../paraglide/runtime.js";
import { typedRequest } from "./generated/typed-request";

export const searchBooks = (query: string) =>
  typedRequest("/books/search", { query: { q: query, lang: getLocale() } });

export interface ListBooksFilters {
  query?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

export function listBooks(filters: ListBooksFilters = {}) {
  return typedRequest("/books", {
    query: {
      lang: getLocale(),
      q: filters.query,
      favorite: filters.favorite ? "true" : undefined,
      status: filters.statuses,
      sort: filters.sort,
      order: filters.order,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
    },
  });
}

/** What's left in the pile among the entries `listBooks` returns for the same filters. */
export function getBooksPile(filters: ListBooksFilters = {}) {
  return typedRequest("/books/pile", {
    query: {
      lang: getLocale(),
      q: filters.query,
      favorite: filters.favorite ? "true" : undefined,
      status: filters.statuses,
    },
  });
}

export function getBookDetail(
  source: string,
  sourceId: string,
  edition?: string,
) {
  return typedRequest("/books/{source}/{sourceId}", {
    params: { source: source.toLowerCase(), sourceId },
    query: { lang: getLocale(), edition },
  });
}

export function getBookEditions(source: string, sourceId: string) {
  return typedRequest("/books/{source}/{sourceId}/editions", {
    params: { source: source.toLowerCase(), sourceId },
    query: { lang: getLocale() },
  });
}

export const upsertBookEntry = (body: UpsertBookEntryDto) =>
  typedRequest("/books", { method: "PUT", body });

export const updateBookEntry = (entryId: string, body: UpdateBookEntryDto) =>
  typedRequest("/books/entries/{id}", {
    method: "PATCH",
    params: { id: entryId },
    body,
  });

export const deleteBookEntry = (entryId: string): Promise<void> =>
  typedRequest("/books/entries/{id}", {
    method: "DELETE",
    params: { id: entryId },
  });

export const addBookReplay = (entryId: string) =>
  typedRequest("/books/entries/{id}/replays", {
    method: "POST",
    params: { id: entryId },
    body: {},
  });

export const deleteBookReplay = (replayId: string): Promise<void> =>
  typedRequest("/books/replays/{id}", {
    method: "DELETE",
    params: { id: replayId },
  });

export const getBookSessions = (entryId: string, page = 1) =>
  typedRequest("/books/entries/{id}/sessions", {
    params: { id: entryId },
    query: { page: String(page) },
  });

export const createBookSession = (
  entryId: string,
  body: CreateBookSessionDto,
) =>
  typedRequest("/books/entries/{id}/sessions", {
    method: "POST",
    params: { id: entryId },
    body,
  });

export const updateBookSession = (
  sessionId: string,
  body: UpdateBookSessionDto,
) =>
  typedRequest("/books/sessions/{id}", {
    method: "PATCH",
    params: { id: sessionId },
    body,
  });

export const deleteBookSession = (sessionId: string): Promise<void> =>
  typedRequest("/books/sessions/{id}", {
    method: "DELETE",
    params: { id: sessionId },
  });

export const getReadingGoal = (year: number) =>
  typedRequest("/books/reading-goal", { query: { year: String(year) } });

export const upsertReadingGoal = (body: UpsertReadingGoalDto) =>
  typedRequest("/books/reading-goal", { method: "PUT", body });

export const bulkUpdateBookEntries = (
  body: BulkUpdateEntriesDto<BookStatus, BookOwnershipStatus>,
) => typedRequest("/books/entries/bulk", { method: "POST", body });

export const bulkDeleteBookEntries = (body: BulkEntriesTargetDto) =>
  typedRequest("/books/entries/bulk-delete", { method: "POST", body });
