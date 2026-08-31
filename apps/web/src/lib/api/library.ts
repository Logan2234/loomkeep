import type {
  LibraryEntryDto,
  MediaType,
  UpsertLibraryEntryDto,
} from "@loomkeep/shared";
import { getLocale } from "../paraglide/runtime.js";
import { typedRequest } from "./generated/typed-request";

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

export function listLibrary(filters: ListLibraryFilters = {}) {
  return typedRequest("/library", {
    query: {
      lang: getLocale(),
      q: filters.query,
      favorite: filters.favorite ? "true" : undefined,
      status: filters.statuses,
      type: filters.types,
      sort: filters.sort,
      order: filters.order,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
    },
  });
}

export const upsertLibraryEntry = (body: UpsertLibraryEntryDto) =>
  typedRequest("/library", { method: "PUT", body });

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
) =>
  typedRequest("/library/entries/{id}", {
    method: "PATCH",
    params: { id: entryId },
    body,
  });

export const deleteLibraryEntry = (entryId: string): Promise<void> =>
  typedRequest("/library/entries/{id}", {
    method: "DELETE",
    params: { id: entryId },
  });

// Movies only.
export const addLibraryReplay = (entryId: string) =>
  typedRequest("/library/entries/{id}/replays", {
    method: "POST",
    params: { id: entryId },
    body: {},
  });

export const deleteLibraryReplay = (replayId: string): Promise<void> =>
  typedRequest("/library/replays/{id}", {
    method: "DELETE",
    params: { id: replayId },
  });

export const watchEpisode = (episodeId: string) =>
  typedRequest("/library/episodes/{episodeId}/watches", {
    method: "POST",
    params: { episodeId },
    body: {},
  });

/** Mark every not-yet-watched episode of a season as watched. */
export const watchSeason = (seasonId: string): Promise<void> =>
  typedRequest("/library/seasons/{seasonId}/watches", {
    method: "POST",
    params: { seasonId },
  });

/** Mark all regular episodes up to and including this one (specials excluded). */
export const watchThrough = (episodeId: string): Promise<void> =>
  typedRequest("/library/episodes/{episodeId}/watch-through", {
    method: "POST",
    params: { episodeId },
  });

/** Undo the most recent watch of an episode (unwatches it at a single watch). */
export const unwatchEpisode = (episodeId: string): Promise<void> =>
  typedRequest("/library/episodes/{episodeId}/watches", {
    method: "DELETE",
    params: { episodeId },
  });

/** Clear every watch (all rewatches included) for every episode of a season. */
export const unwatchSeason = (seasonId: string): Promise<void> =>
  typedRequest("/library/seasons/{seasonId}/watches", {
    method: "DELETE",
    params: { seasonId },
  });

export const getCalendar = () => typedRequest("/library/calendar");
