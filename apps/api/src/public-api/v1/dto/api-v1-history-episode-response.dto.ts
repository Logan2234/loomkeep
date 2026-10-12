import type { ApiV1HistoryEventDto } from "@loomkeep/shared";

export class ApiV1HistoryEpisodeResponseDto implements NonNullable<
  ApiV1HistoryEventDto["episode"]
> {
  /**
   * Season number; 0 holds the specials.
   * @example 2
   */
  seasonNumber!: number;

  /**
   * Episode number within the season.
   * @example 4
   */
  episodeNumber!: number;

  /**
   * The episode's title; null when the catalogue has none.
   * @example "Hide and Seek"
   */
  title!: string | null;
}
