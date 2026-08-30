import type {
  BookDetailDto,
  BookEntryDto,
  BookSearchResponseDto,
  PagedResult,
  ReadingGoalDto,
  UpdateBookEntryDto,
  UpsertBookEntryDto,
  UpsertReadingGoalDto,
} from "@loomkeep/shared";
import { getLocale } from "../paraglide/runtime.js";
import { request } from "./core";

export function searchBooks(query: string): Promise<BookSearchResponseDto> {
  const params = new URLSearchParams({ q: query, lang: getLocale() });
  return request(`/books/search?${params}`);
}

export interface ListBooksFilters {
  query?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

export function listBooks(
  filters: ListBooksFilters = {},
): Promise<PagedResult<BookEntryDto>> {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.favorite) params.set("favorite", "true");
  for (const s of filters.statuses ?? []) params.append("status", s);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/books${suffix}`);
}

export function getBookDetail(
  source: string,
  sourceId: string,
): Promise<BookDetailDto> {
  const params = new URLSearchParams({ lang: getLocale() });
  return request(`/books/${source.toLowerCase()}/${sourceId}?${params}`);
}

export const upsertBookEntry = (
  body: UpsertBookEntryDto,
): Promise<BookEntryDto> => request("/books", { method: "PUT", body });

export const updateBookEntry = (
  entryId: string,
  body: UpdateBookEntryDto,
): Promise<BookEntryDto> =>
  request(`/books/entries/${entryId}`, { method: "PATCH", body });

export const deleteBookEntry = (entryId: string): Promise<void> =>
  request(`/books/entries/${entryId}`, { method: "DELETE" });

export const addBookReplay = (entryId: string): Promise<BookEntryDto> =>
  request(`/books/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });

export const deleteBookReplay = (replayId: string): Promise<void> =>
  request(`/books/replays/${replayId}`, { method: "DELETE" });

export const getReadingGoal = (year: number): Promise<ReadingGoalDto> =>
  request(`/books/reading-goal?year=${year}`);

export const upsertReadingGoal = (
  body: UpsertReadingGoalDto,
): Promise<ReadingGoalDto> =>
  request("/books/reading-goal", { method: "PUT", body });
