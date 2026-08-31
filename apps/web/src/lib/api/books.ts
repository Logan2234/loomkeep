import type {
  UpdateBookEntryDto,
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
      q: filters.query,
      favorite: filters.favorite ? "true" : undefined,
      status: filters.statuses,
      sort: filters.sort,
      order: filters.order,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
    },
  });
}

export function getBookDetail(source: string, sourceId: string) {
  return typedRequest("/books/{source}/{sourceId}", {
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

export const getReadingGoal = (year: number) =>
  typedRequest("/books/reading-goal", { query: { year: String(year) } });

export const upsertReadingGoal = (body: UpsertReadingGoalDto) =>
  typedRequest("/books/reading-goal", { method: "PUT", body });
