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
import { request } from "./core";

export function searchBooks(query: string): Promise<BookSearchResponseDto> {
  const params = new URLSearchParams({ q: query });
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

/** Book detail (catalogue metadata + the user's library state). */
export function getBookDetail(
  source: string,
  sourceId: string,
): Promise<BookDetailDto> {
  return request(`/books/${source.toLowerCase()}/${sourceId}`);
}

export function upsertBookEntry(
  body: UpsertBookEntryDto,
): Promise<BookEntryDto> {
  return request("/books", { method: "PUT", body });
}

export function updateBookEntry(
  entryId: string,
  body: UpdateBookEntryDto,
): Promise<BookEntryDto> {
  return request(`/books/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteBookEntry(entryId: string): Promise<void> {
  return request(`/books/entries/${entryId}`, { method: "DELETE" });
}

/** Log a completed reread (a completion beyond the entry's first one). */
export function addBookReplay(entryId: string): Promise<BookEntryDto> {
  return request(`/books/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });
}

export function deleteBookReplay(replayId: string): Promise<void> {
  return request(`/books/replays/${replayId}`, { method: "DELETE" });
}

export function getReadingGoal(year: number): Promise<ReadingGoalDto> {
  return request(`/books/reading-goal?year=${year}`);
}

export function upsertReadingGoal(
  body: UpsertReadingGoalDto,
): Promise<ReadingGoalDto> {
  return request("/books/reading-goal", { method: "PUT", body });
}
