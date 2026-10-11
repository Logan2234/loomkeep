import type { ApiV1StatsSummaryDto } from "@loomkeep/shared";

export class ApiV1MusicStatsResponseDto implements NonNullable<
  ApiV1StatsSummaryDto["music"]
> {
  /**
   * Length of the albums listened to, in minutes.
   * @example 9640
   */
  listenDurationMin!: number;
}
