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

export const getCastDetail = (
  source: string,
  id: string,
): Promise<CastDetailDto> =>
  request(`/catalog/${source.toLowerCase()}/person/${id}`);

// Addressed by catalogue identity — `type` implies the source, so no source
// segment is needed in the URL.
export function getMediaDetail(
  type: MediaType,
  sourceId: string,
): Promise<MediaDetailDto> {
  const params = new URLSearchParams({ lang: getLocale() });
  return request(`/media/${type.toLowerCase()}/${sourceId}?${params}`);
}
