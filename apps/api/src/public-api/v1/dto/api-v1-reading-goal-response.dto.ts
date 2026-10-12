import type { ApiV1StatsSummaryDto } from "@loomkeep/shared";

export class ApiV1ReadingGoalResponseDto implements NonNullable<
  NonNullable<ApiV1StatsSummaryDto["books"]>["readingGoal"]
> {
  /**
   * The goal's year.
   * @example 2026
   */
  year!: number;

  /**
   * Books to read that year.
   * @example 24
   */
  target!: number;

  /**
   * Books finished so far that year.
   * @example 17
   */
  completed!: number;
}
