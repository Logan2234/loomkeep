import type { ApiV1ProgressDto } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
export class ApiV1ProgressResponseDto implements ApiV1ProgressDto {
  /**
   * How far along: episodes watched, current page or minutes played.
   * @example 12
   */
  current!: number;

  /**
   * The total, when known: episodes aired or pages; null for a game's length
   * or a book without a page count.
   * @example 19
   */
  total!: number | null;

  /**
   * What `current` and `total` count.
   * @example "episodes"
   */
  @ApiProperty({ enum: ["episodes", "pages", "minutes"] })
  unit!: "episodes" | "pages" | "minutes";
}
