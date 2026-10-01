import type { DataExportReadingGoal } from "@loomkeep/shared";

export class DataExportReadingGoalResponseDto implements DataExportReadingGoal {
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
   * When it was set.
   * @example "2026-01-02T09:00:00.000Z"
   */
  createdAt!: string;

  /**
   * When it last changed.
   * @example "2026-01-02T09:00:00.000Z"
   */
  updatedAt!: string;
}
