import type { ApiV1ProfileDto } from "@loomkeep/shared";

export class ApiV1ProgressionResponseDto implements NonNullable<
  ApiV1ProfileDto["progression"]
> {
  /**
   * Experience points earned in total.
   * @example 15240
   */
  xp!: number;

  /**
   * Current level.
   * @example 23
   */
  level!: number;

  /**
   * Points earned since reaching this level.
   * @example 340
   */
  xpInLevel!: number;

  /**
   * Points still needed for the next level.
   * @example 860
   */
  xpToNext!: number;
}
