import type { ApiV1StatsSummaryDto } from "@loomkeep/shared";

export class ApiV1GameStatsResponseDto implements NonNullable<
  ApiV1StatsSummaryDto["games"]
> {
  /**
   * Time spent playing, in minutes.
   * @example 24310
   */
  totalPlaytimeMinutes!: number;
}
