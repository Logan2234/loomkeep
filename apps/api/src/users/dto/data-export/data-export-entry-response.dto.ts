import type {
  CatalogSource,
  DataExportEntry,
  EntryStatus,
  MediaType,
} from "@loomkeep/shared";

class DataExportEntryExternalIdResponseDto {
  /**
   * The catalogue or service the id belongs to.
   * @example "TVDB"
   */
  source!: string;

  /**
   * The id there.
   * @example "371980"
   */
  externalId!: string;
}

class DataExportEntryMediaResponseDto {
  /**
   * MOVIE, SERIES or ANIME.
   * @example "SERIES"
   */
  type!: MediaType;

  /**
   * The title.
   * @example "Severance"
   */
  title!: string;

  /**
   * The catalogue Loomkeep reads it from.
   * @example "TMDB"
   */
  canonicalSource!: CatalogSource;

  /**
   * Its id in that catalogue.
   * @example "95396"
   */
  sourceId!: string;

  /** Its ids in other catalogues, to match it elsewhere. */
  externalIds!: DataExportEntryExternalIdResponseDto[];
}

export class DataExportEntryResponseDto implements DataExportEntry {
  /** The film, series or anime. */
  media!: DataExportEntryMediaResponseDto;

  /**
   * Its status.
   * @example "WATCHING"
   */
  status!: EntryStatus;

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

  /**
   * When each rewatch of a film ended.
   * @example ["2026-03-01T20:00:00.000Z"]
   */
  replays!: string[];
}
