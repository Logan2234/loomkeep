import type {
  CalendarEntryDto,
  EpisodeWatchDto,
  LibraryEntryDto,
  MediaType,
  PagedResult,
  UpsertLibraryEntryDto,
} from "@tracklore/shared";
import { request } from "./core";

export interface ListLibraryFilters {
  query?: string;
  favorite?: boolean;
  /** Includes the synthetic "DORMANT" status alongside real `EntryStatus` values. */
  statuses?: string[];
  types?: MediaType[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

export function listLibrary(
  filters: ListLibraryFilters = {},
): Promise<PagedResult<LibraryEntryDto>> {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.favorite) params.set("favorite", "true");
  for (const s of filters.statuses ?? []) params.append("status", s);
  for (const t of filters.types ?? []) params.append("type", t);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/library${suffix}`);
}

export function upsertLibraryEntry(
  body: UpsertLibraryEntryDto,
): Promise<LibraryEntryDto> {
  return request("/library", { method: "PUT", body });
}

export function updateLibraryEntry(
  entryId: string,
  body: Partial<
    Pick<
      LibraryEntryDto,
      | "status"
      | "rating"
      | "notes"
      | "favorite"
      | "ownershipStatus"
      | "ownershipSource"
    >
  >,
): Promise<LibraryEntryDto> {
  return request(`/library/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteLibraryEntry(entryId: string): Promise<void> {
  return request(`/library/entries/${entryId}`, { method: "DELETE" });
}

export function watchEpisode(episodeId: string): Promise<EpisodeWatchDto> {
  return request(`/library/episodes/${episodeId}/watches`, {
    method: "POST",
    body: {},
  });
}

/** Mark every not-yet-watched episode of a season as watched. */
export function watchSeason(seasonId: string): Promise<void> {
  return request(`/library/seasons/${seasonId}/watches`, { method: "POST" });
}

/** Mark all regular episodes up to and including this one (specials excluded). */
export function watchThrough(episodeId: string): Promise<void> {
  return request(`/library/episodes/${episodeId}/watch-through`, {
    method: "POST",
  });
}

/** Undo the most recent watch of an episode (unwatches it at a single watch). */
export function unwatchEpisode(episodeId: string): Promise<void> {
  return request(`/library/episodes/${episodeId}/watches`, {
    method: "DELETE",
  });
}

export function getCalendar(): Promise<CalendarEntryDto[]> {
  return request("/library/calendar");
}
