import type {
  CastDetailDto,
  MediaDetailDto,
  MediaExtrasDto,
  MediaType,
  SearchResponseDto,
} from "@loomkeep/shared";
import { getLocale } from "../paraglide/runtime.js";
import { request } from "./core";

export function searchCatalog(
  query: string,
  type?: MediaType,
  page = 1,
): Promise<SearchResponseDto> {
  const params = new URLSearchParams({ q: query, lang: getLocale() });
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));
  return request(`/catalog/search?${params}`);
}

/** Live extras (where to watch, cast, similar) — not persisted. */
export function getMediaExtras(
  source: string,
  sourceId: string,
  type: MediaType,
): Promise<MediaExtrasDto> {
  const params = new URLSearchParams({ type, lang: getLocale() });
  return request(
    `/catalog/${source.toLowerCase()}/${sourceId}/extras?${params}`,
  );
}

/** Live detail of a cast entity (TMDB person) for the cast modal. */
export function getCastDetail(
  source: string,
  id: string,
): Promise<CastDetailDto> {
  return request(`/catalog/${source.toLowerCase()}/person/${id}`);
}

/**
 * Unified media page: metadata + the user's library state (`entry` null when
 * not in the library). Addressed by catalogue identity — `type` implies the
 * source, so no source segment is needed.
 */
export function getMediaDetail(
  type: MediaType,
  sourceId: string,
): Promise<MediaDetailDto> {
  const params = new URLSearchParams({ lang: getLocale() });
  return request(`/media/${type.toLowerCase()}/${sourceId}?${params}`);
}
