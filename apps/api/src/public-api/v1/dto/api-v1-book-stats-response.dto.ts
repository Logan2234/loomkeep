import type { ApiV1StatsSummaryDto } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1ReadingGoalResponseDto } from "./api-v1-reading-goal-response.dto";
export class ApiV1BookStatsResponseDto implements NonNullable<
  ApiV1StatsSummaryDto["books"]
> {
  /**
   * Pages read in total.
   * @example 18420
   */
  pagesRead!: number;

  /** This year's reading goal; null when none is set. */
  @ApiProperty({ type: ApiV1ReadingGoalResponseDto, nullable: true })
  readingGoal!: ApiV1ReadingGoalResponseDto | null;
}
