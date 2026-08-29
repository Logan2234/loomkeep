import type {
  GameDetailDto,
  GameEntryDto,
  GameSearchResponseDto,
  PagedResult,
  UpdateGameEntryDto,
  UpsertGameEntryDto,
} from "@loomkeep/shared";
import { request } from "./core";

export function searchGames(query: string): Promise<GameSearchResponseDto> {
  const params = new URLSearchParams({ q: query });
  return request(`/games/search?${params}`);
}

export interface ListGamesFilters {
  query?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

export function listGames(
  filters: ListGamesFilters = {},
): Promise<PagedResult<GameEntryDto>> {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.favorite) params.set("favorite", "true");
  for (const s of filters.statuses ?? []) params.append("status", s);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/games${suffix}`);
}

/** Game detail (catalogue metadata + the user's library state). */
export const getGameDetail = (
  source: string,
  sourceId: string,
): Promise<GameDetailDto> =>
  request(`/games/${source.toLowerCase()}/${sourceId}`);

export const upsertGameEntry = (
  body: UpsertGameEntryDto,
): Promise<GameEntryDto> => request("/games", { method: "PUT", body });

export const updateGameEntry = (
  entryId: string,
  body: UpdateGameEntryDto,
): Promise<GameEntryDto> =>
  request(`/games/entries/${entryId}`, { method: "PATCH", body });

export const deleteGameEntry = (entryId: string): Promise<void> =>
  request(`/games/entries/${entryId}`, { method: "DELETE" });

/** Log a completed replay (a completion beyond the entry's first one). */
export const addGameReplay = (entryId: string): Promise<GameEntryDto> =>
  request(`/games/entries/${entryId}/replays`, {
    method: "POST",
    body: {},
  });

export const deleteGameReplay = (replayId: string): Promise<void> =>
  request(`/games/replays/${replayId}`, { method: "DELETE" });
