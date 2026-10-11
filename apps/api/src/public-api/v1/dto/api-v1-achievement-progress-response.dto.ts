import type { ApiV1AchievementDto } from "@loomkeep/shared";

export class ApiV1AchievementProgressResponseDto implements NonNullable<
  ApiV1AchievementDto["progress"]
> {
  /**
   * Progress so far.
   * @example 37
   */
  current!: number;

  /**
   * What unlocking takes.
   * @example 50
   */
  target!: number;
}
