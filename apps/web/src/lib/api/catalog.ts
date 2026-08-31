import type { MediaDetailDto, MediaType } from "@loomkeep/shared";
import { getLocale } from "../paraglide/runtime.js";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

export function searchCatalog(query: string, type?: MediaType, page = 1) {
  return typedRequest("/catalog/search", {
    query: {
      q: query,
      lang: getLocale(),
      type,
      page: page > 1 ? page : undefined,
    },
  });
}

export function getMediaExtras(
  source: string,
  sourceId: string,
  type: MediaType,
) {
  return typedRequest("/catalog/{source}/{id}/extras", {
    params: { source: source.toLowerCase(), id: sourceId },
    query: { type, lang: getLocale() },
  });
}

export const getCastDetail = (source: string, id: string) =>
  typedRequest("/catalog/{source}/person/{id}", {
    params: { source: source.toLowerCase(), id },
  });

// Addressed by catalogue identity — `type` implies the source, so no source
// segment is needed in the URL.
export function getMediaDetail(
  type: MediaType,
  sourceId: string,
): Promise<MediaDetailDto> {
  const params = new URLSearchParams({ lang: getLocale() });
  return request(`/media/${type.toLowerCase()}/${sourceId}?${params}`);
}
