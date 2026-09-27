import { getLocale } from "$lib/paraglide/runtime.js";
import type {
  CreateGameSessionDto,
  UpdateGameEntryDto,
  UpdateGameSessionDto,
  UpsertGameEntryDto,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const searchGames = (query: string) =>
  typedRequest("/games/search", { query: { q: query } });

export interface ListGamesFilters {
  query?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
}

export function listGames(filters: ListGamesFilters = {}) {
  return typedRequest("/games", {
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

export const getGameDetail = (source: string, sourceId: string) =>
  typedRequest("/games/{source}/{sourceId}", {
    params: { source: source.toLowerCase(), sourceId },
  });

export const upsertGameEntry = (body: UpsertGameEntryDto) =>
  typedRequest("/games", { method: "PUT", body });

export const updateGameEntry = (entryId: string, body: UpdateGameEntryDto) =>
  typedRequest("/games/entries/{id}", {
    method: "PATCH",
    params: { id: entryId },
    body,
  });

export const deleteGameEntry = (entryId: string): Promise<void> =>
  typedRequest("/games/entries/{id}", {
    method: "DELETE",
    params: { id: entryId },
  });

export const addGameReplay = (entryId: string) =>
  typedRequest("/games/entries/{id}/replays", {
    method: "POST",
    params: { id: entryId },
    body: {},
  });

export const deleteGameReplay = (replayId: string): Promise<void> =>
  typedRequest("/games/replays/{id}", {
    method: "DELETE",
    params: { id: replayId },
  });

export const getGameSessions = (entryId: string, page = 1) =>
  typedRequest("/games/entries/{id}/sessions", {
    params: { id: entryId },
    query: { page: String(page) },
  });

export const createGameSession = (
  entryId: string,
  body: CreateGameSessionDto,
) =>
  typedRequest("/games/entries/{id}/sessions", {
    method: "POST",
    params: { id: entryId },
    body,
  });

export const updateGameSession = (
  sessionId: string,
  body: UpdateGameSessionDto,
) =>
  typedRequest("/games/sessions/{id}", {
    method: "PATCH",
    params: { id: sessionId },
    body,
  });

export const deleteGameSession = (sessionId: string): Promise<void> =>
  typedRequest("/games/sessions/{id}", {
    method: "DELETE",
    params: { id: sessionId },
  });
