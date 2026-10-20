import type { DataExportImportRun } from "@loomkeep/shared";

export class DataExportImportRunResponseDto implements DataExportImportRun {
  /**
   * The source imported from.
   * @example "tvtime"
   */
  sourceId!: string;

  /**
   * How it ended: SUCCESS or FAILURE.
   * @example "SUCCESS"
   */
  status!: string;

  /**
   * Items imported.
   * @example 412
   */
  itemCount!: number;

  /**
   * Whether existing entries were overwritten.
   * @example false
   */
  overwrite!: boolean;

  /**
   * A summary of the outcome.
   * @example "412 imported, 3 not found"
   */
  summary!: string | null;

  /**
   * Why it failed, if it did.
   * @example "The archive is missing watched_episodes.csv"
   */
  error!: string | null;

  /**
   * When it started.
   * @example "2026-03-14T09:26:53.000Z"
   */
  startedAt!: string;

  /**
   * When it ended.
   * @example "2026-03-14T09:26:53.000Z"
   */
  finishedAt!: string;
}
