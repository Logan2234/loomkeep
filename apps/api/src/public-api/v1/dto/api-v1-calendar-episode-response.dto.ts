import type { ApiV1CalendarEpisodeDto } from "@loomkeep/shared";

import { ApiV1WorkResponseDto } from "./api-v1-work-response.dto";
export class ApiV1CalendarEpisodeResponseDto implements ApiV1CalendarEpisodeDto {
  /**
   * When the episode airs.
   * @example "2026-10-03T00:00:00.000Z"
   */
  airDate!: string;

  /**
   * Season number.
   * @example 2
   */
  seasonNumber!: number;

  /**
   * Episode number within the season.
   * @example 8
   */
  episodeNumber!: number;

  /**
   * The episode's title, when known yet.
   * @example "Sweet Vitriol"
   */
  episodeTitle!: string | null;

  /**
   * Aired episodes of the same show not watched yet, before this one.
   * @example 1
   */
  episodesBehind!: number;

  /** The show. */
  work!: ApiV1WorkResponseDto;
}
