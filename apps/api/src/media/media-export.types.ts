import type {
  CatalogSource,
  EntryStatus,
  MediaType,
} from "@loomkeep/shared/enums";

// What the account export (`GET /users/me/export`) holds for the media library.

export interface DataExportEntry {
  media: {
    type: MediaType;
    title: string;
    canonicalSource: CatalogSource;
    /** ID in `canonicalSource` — forms the catalogue identity with `type`. */
    sourceId: string;
    /** All known cross-source identifiers (TMDB, ANILIST, TVDB, IMDB). */
    externalIds: { source: string; externalId: string }[];
  };
  status: EntryStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** When each rewatch of a film ended. */
  replays: string[];
}

export interface DataExportWatch {
  media: { type: MediaType; title: string; sourceId: string };
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  watchedAt: string | null;
}
