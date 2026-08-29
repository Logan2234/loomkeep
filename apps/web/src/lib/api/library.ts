import type {
  CalendarEntryDto,
  EpisodeWatchDto,
  LibraryEntryDto,
  MediaType,
  PagedResult,
  UpsertLibraryEntryDto,
} from "@loomkeep/shared";
import { getLocale } from "../paraglide/runtime.js";
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
  const params = new URLSearchParams({ lang: getLocale() });
  if (filters.query) params.set("q", filters.query);
  if (filters.favorite) params.set("favorite", "true");
  for (const s of filters.statuses ?? []) params.append("status", s);
  for (const t of filters.types ?? []) params.append("type", t);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  return request(`/library?${params}`);
}

export const upsertLibraryEntry = (
  body: UpsertLibraryEntryDto,
): Promise<LibraryEntryDto> => request("/library", { method: "PUT", body });

export const updateLibraryEntry = (
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
): Promise<LibraryEntryDto> =>
  request(`/library/entries/${entryId}`, { method: "PATCH", body });

export const deleteLibraryEntry = (entryId: string): Promise<void> =>
  request(`/library/entries/${entryId}`, { method: "DELETE" });

/** Log a completed rewatch (a completion beyond the entry's first one). Movies only. */
export const addLibraryReplay = (entryId: string): Promise<LibraryEntryDto> =>
  request(`/library/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });

export const deleteLibraryReplay = (replayId: string): Promise<void> =>
  request(`/library/replays/${replayId}`, { method: "DELETE" });

export const watchEpisode = (episodeId: string): Promise<EpisodeWatchDto> =>
  request(`/library/episodes/${episodeId}/watches`, {
    method: "POST",
    body: {},
  });

/** Mark every not-yet-watched episode of a season as watched. */
export const watchSeason = (seasonId: string): Promise<void> =>
  request(`/library/seasons/${seasonId}/watches`, { method: "POST" });

/** Mark all regular episodes up to and including this one (specials excluded). */
export const watchThrough = (episodeId: string): Promise<void> =>
  request(`/library/episodes/${episodeId}/watch-through`, {
    method: "POST",
  });

/** Undo the most recent watch of an episode (unwatches it at a single watch). */
export const unwatchEpisode = (episodeId: string): Promise<void> =>
  request(`/library/episodes/${episodeId}/watches`, {
    method: "DELETE",
  });

/** Clear every watch (all rewatches included) for every episode of a season. */
export const unwatchSeason = (seasonId: string): Promise<void> =>
  request(`/library/seasons/${seasonId}/watches`, {
    method: "DELETE",
  });

export const getCalendar = (): Promise<CalendarEntryDto[]> =>
  request("/library/calendar");
