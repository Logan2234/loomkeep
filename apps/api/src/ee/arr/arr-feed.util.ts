import type { ExternalSource, MediaType } from "@prisma/client";

export interface ArrFeedItem {
  title: string;
  type: MediaType;
  externalIds: { source: ExternalSource; externalId: string }[];
}

/** Radarr's "StevenLu Custom" import list: a JSON array read by `imdb_id`. */
export interface RadarrListItem {
  title: string;
  imdb_id: string;
}

/** Sonarr's "Custom List" import list: a JSON array read by `tvdbId`. */
export interface SonarrListItem {
  title: string;
  tvdbId: number;
}

const idOf = (item: ArrFeedItem, source: ExternalSource) =>
  item.externalIds.find((id) => id.source === source)?.externalId;

// A title without the id the tool looks up by is left out rather than sent
// by name: a search on a title alone can queue the wrong film or series.

export function radarrList(items: ArrFeedItem[]): RadarrListItem[] {
  return items.flatMap((item) => {
    const imdbId = idOf(item, "IMDB");
    return item.type === "MOVIE" && imdbId
      ? [{ title: item.title, imdb_id: imdbId }]
      : [];
  });
}

export function sonarrList(items: ArrFeedItem[]): SonarrListItem[] {
  return items.flatMap((item) => {
    const tvdbId = Number(idOf(item, "TVDB"));
    return item.type !== "MOVIE" && Number.isInteger(tvdbId) && tvdbId > 0
      ? [{ title: item.title, tvdbId }]
      : [];
  });
}
