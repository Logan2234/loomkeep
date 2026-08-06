import type {
  MusicDetailDto,
  MusicEntryDto,
  MusicSearchResponseDto,
  PagedResult,
  UpdateMusicEntryDto,
  UpsertMusicEntryDto,
} from "@loomkeep/shared";
import { request } from "./core";

export function searchMusic(query: string): Promise<MusicSearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  return request(`/music/search?${params}`);
}

export interface ListMusicFilters {
  query?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

export function listMusic(
  filters: ListMusicFilters = {},
): Promise<PagedResult<MusicEntryDto>> {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.favorite) params.set("favorite", "true");
  for (const s of filters.statuses ?? []) params.append("status", s);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/music${suffix}`);
}

/** Album detail (catalogue metadata + the user's library state). */
export function getMusicDetail(
  source: string,
  sourceId: string,
): Promise<MusicDetailDto> {
  return request(`/music/${source.toLowerCase()}/${sourceId}`);
}

export function upsertMusicEntry(
  body: UpsertMusicEntryDto,
): Promise<MusicEntryDto> {
  return request("/music", { method: "PUT", body });
}

export function updateMusicEntry(
  entryId: string,
  body: UpdateMusicEntryDto,
): Promise<MusicEntryDto> {
  return request(`/music/entries/${entryId}`, { method: "PATCH", body });
}

export function deleteMusicEntry(entryId: string): Promise<void> {
  return request(`/music/entries/${entryId}`, { method: "DELETE" });
}
