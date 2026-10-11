import type { ApiV1Phase } from "@loomkeep/shared";

export class ApiV1PhaseCountsResponseDto implements Record<ApiV1Phase, number> {
  /**
   * Entries not started yet.
   * @example 112
   */
  PLANNED!: number;

  /**
   * Entries under way.
   * @example 9
   */
  IN_PROGRESS!: number;

  /**
   * Entries finished.
   * @example 431
   */
  DONE!: number;

  /**
   * Entries given up.
   * @example 17
   */
  DROPPED!: number;
}
