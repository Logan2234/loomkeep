import type { ApiV1StatsSummaryDto } from "@loomkeep/shared";

export class ApiV1VideoStatsResponseDto implements NonNullable<
  ApiV1StatsSummaryDto["video"]
> {
  /**
   * Time spent watching films and episodes, in minutes.
   * @example 182340
   */
  totalMinutes!: number;

  /**
   * Episodes watched, rewatches included.
   * @example 3214
   */
  episodesWatched!: number;
}
