import type {
  UpdateMusicEntryDto,
  UpsertMusicEntryDto,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const searchMusic = (query: string) =>
  typedRequest("/music/search", { query: { q: query } });

export interface ListMusicFilters {
  query?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

export function listMusic(filters: ListMusicFilters = {}) {
  return typedRequest("/music", {
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

export const getMusicDetail = (source: string, sourceId: string) =>
  typedRequest("/music/{source}/{sourceId}", {
    params: { source: source.toLowerCase(), sourceId },
  });

export const upsertMusicEntry = (body: UpsertMusicEntryDto) =>
  typedRequest("/music", { method: "PUT", body });

export const updateMusicEntry = (entryId: string, body: UpdateMusicEntryDto) =>
  typedRequest("/music/entries/{id}", {
    method: "PATCH",
    params: { id: entryId },
    body,
  });

export const deleteMusicEntry = (entryId: string): Promise<void> =>
  typedRequest("/music/entries/{id}", {
    method: "DELETE",
    params: { id: entryId },
  });
