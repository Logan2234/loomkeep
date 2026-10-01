import type {
  DataExportMusicEntry,
  MusicOwnershipStatus,
  MusicSource,
  MusicStatus,
} from "@loomkeep/shared";

class DataExportMusicExternalIdResponseDto {
  /**
   * The catalogue or service the id belongs to.
   * @example "MUSICBRAINZ"
   */
  source!: string;

  /**
   * The id there.
   * @example "b1392450-e666-3926-a536-22c65f834433"
   */
  externalId!: string;
}

class DataExportMusicEntryAlbumResponseDto {
  /**
   * The album's title.
   * @example "OK Computer"
   */
  title!: string;

  /**
   * Its artists.
   * @example ["Radiohead"]
   */
  artists!: string[];

  /**
   * The catalogue Loomkeep reads it from.
   * @example "MUSICBRAINZ"
   */
  canonicalSource!: MusicSource;

  /**
   * Its id in that catalogue.
   * @example "b1392450-e666-3926-a536-22c65f834433"
   */
  sourceId!: string;

  /** Its ids in the catalogue. */
  externalIds!: DataExportMusicExternalIdResponseDto[];
}

export class DataExportMusicEntryResponseDto implements DataExportMusicEntry {
  /** The album. */
  album!: DataExportMusicEntryAlbumResponseDto;

  /**
   * Its status.
   * @example "LISTENED"
   */
  status!: MusicStatus;

  /**
   * The account's rating, 0 to 10 with half points.
   * @example 8.5
   */
  rating!: number | null;

  /**
   * Private notes on the entry.
   * @example "Lent by Max"
   */
  notes!: string | null;

  /**
   * Marked as a favourite.
   * @example true
   */
  favorite!: boolean;

  /**
   * How the album is held.
   * @example "STREAMING"
   */
  ownershipStatus!: MusicOwnershipStatus;

  /**
   * Where, for a digital or streaming copy.
   * @example "Spotify"
   */
  ownershipSource!: string | null;

  /**
   * When it was started.
   * @example "2026-08-02T20:15:00.000Z"
   */
  startedAt!: string | null;

  /**
   * When it was finished.
   * @example "2026-08-30T22:40:00.000Z"
   */
  finishedAt!: string | null;

  /**
   * When it was added to the library.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;
}
