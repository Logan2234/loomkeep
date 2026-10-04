import { getLocale } from "$lib/paraglide/runtime.js";
import type {
  BulkEntriesTargetDto,
  BulkUpdateEntriesDto,
  CreateGameSessionDto,
  GameOwnershipStatus,
  GameStatus,
  LibrarySagaSort,
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

/** What's left in the pile among the entries `listGames` returns for the same filters. */
export function getGamesPile(filters: ListGamesFilters = {}) {
  return typedRequest("/games/pile", {
    query: {
      lang: getLocale(),
      q: filters.query,
      favorite: filters.favorite ? "true" : undefined,
      status: filters.statuses,
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

export const bulkUpdateGameEntries = (
  body: BulkUpdateEntriesDto<GameStatus, GameOwnershipStatus>,
) => typedRequest("/games/entries/bulk", { method: "POST", body });

export const bulkDeleteGameEntries = (body: BulkEntriesTargetDto) =>
  typedRequest("/games/entries/bulk-delete", { method: "POST", body });

/** The series a game is a main game of, each game with the player's status. */
export const getGameSaga = (sourceId: string) =>
  typedRequest("/games/{source}/{sourceId}/saga", {
    params: { source: "igdb", sourceId },
  });

export interface GameSagaFilters {
  query?: string;
  sort?: LibrarySagaSort;
  order?: "asc" | "desc";
}

/** The player's series: in progress, waiting on an announced game, finished. */
export const listGameSagas = (filters: GameSagaFilters = {}) =>
  typedRequest("/games/sagas", {
    query: {
      q: filters.query || undefined,
      sort: filters.sort,
      order: filters.order,
    },
  });
