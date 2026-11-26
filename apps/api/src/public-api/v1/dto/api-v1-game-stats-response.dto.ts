import type { ApiV1StatsSummaryDto } from "../api-v1.types";

export class ApiV1GameStatsResponseDto implements NonNullable<
  ApiV1StatsSummaryDto["games"]
> {
  /**
   * Time spent playing, in minutes.
   * @example 24310
   */
  totalPlaytimeMinutes!: number;
}
