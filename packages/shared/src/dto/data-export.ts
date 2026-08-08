import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  CatalogSource,
  EntryStatus,
  GameOwnershipStatus,
  GameSource,
  GameStatus,
  MediaType,
  MusicOwnershipStatus,
  MusicSource,
  MusicStatus,
} from "../enums";
import type { UserDto } from "./auth";

/** One library entry in a data export: the media plus the user's tracking. */
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
}

/** One episode viewing in a data export (rewatches appear as separate rows). */
export interface DataExportWatch {
  media: { type: MediaType; title: string; sourceId: string };
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  watchedAt: string;
}

/** One game library entry in a data export. */
export interface DataExportGameEntry {
  game: {
    title: string;
    canonicalSource: GameSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: GameStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  playtimeMinutes: number;
  ownershipStatus: GameOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed replays beyond the first, oldest first. */
  replays: string[];
}

/** One book library entry in a data export. */
export interface DataExportBookEntry {
  book: {
    title: string;
    authors: string[];
    canonicalSource: BookSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  currentPage: number;
  ownershipStatus: BookOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed rereads beyond the first, oldest first. */
  replays: string[];
}

/** One album library entry in a data export. */
export interface DataExportMusicEntry {
  album: {
    title: string;
    artists: string[];
    canonicalSource: MusicSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: MusicStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  ownershipStatus: MusicOwnershipStatus;
  ownershipSource: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** One in-app notification in a data export. */
export interface DataExportNotification {
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  /** Kind-specific extras (episode airDate, social actor identity…). */
  data: Record<string, unknown>;
  createdAt: string;
}

/** Full portable dump of everything the account holds (GDPR "download my data"). */
export interface UserDataExportDto {
  /** ISO datetime the export was produced. */
  exportedAt: string;
  account: UserDto;
  library: DataExportEntry[];
  episodeWatches: DataExportWatch[];
  games: DataExportGameEntry[];
  books: DataExportBookEntry[];
  music: DataExportMusicEntry[];
  /**
   * Reserved for the planned podcasts domain (see `Domain.PODCASTS`). Present in
   * the schema now so the export shape is stable before the domain ships;
   * always an empty array until then.
   */
  podcasts: never[];
  /** Reserved for the planned board-games domain (see `Domain.BOARDGAMES`); always empty until it ships. */
  boardGames: never[];
  notifications: DataExportNotification[];
}

/**
 * Flat, per-domain CSV export meant for migrating to another tool (as opposed
 * to `UserDataExportDto`, the nested GDPR dump) — one row per library entry.
 */
export interface CsvExportDto {
  csv: string;
}
