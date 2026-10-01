import type { DataExportWatch, MediaType } from "@loomkeep/shared";

class DataExportWatchMediaResponseDto {
  /**
   * SERIES or ANIME.
   * @example "SERIES"
   */
  type!: MediaType;

  /**
   * The show's title.
   * @example "Severance"
   */
  title!: string;

  /**
   * Its id in its catalogue.
   * @example "95396"
   */
  sourceId!: string;
}

export class DataExportWatchResponseDto implements DataExportWatch {
  /** The show. */
  media!: DataExportWatchMediaResponseDto;

  /**
   * Season number; 0 holds the specials.
   * @example 2
   */
  seasonNumber!: number;

  /**
   * Episode number.
   * @example 4
   */
  episodeNumber!: number;

  /**
   * The episode's title.
   * @example "Hide and Seek"
   */
  episodeTitle!: string | null;

  /**
   * When it was watched; null when unknown.
   * @example "2026-09-30T21:00:00.000Z"
   */
  watchedAt!: string | null;
}
