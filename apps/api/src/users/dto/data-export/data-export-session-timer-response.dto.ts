import type { DataExportSessionTimer, Domain } from "@loomkeep/shared";

export class DataExportSessionTimerResponseDto implements DataExportSessionTimer {
  /**
   * What it times.
   * @example "GAMES"
   */
  domain!: Domain;

  /**
   * The game or book it times.
   * @example "Hades"
   */
  title!: string | null;

  /**
   * When it was started.
   * @example "2026-10-03T20:00:00.000Z"
   */
  startedAt!: string;

  /**
   * When it was paused, if it is.
   * @example "2026-10-03T20:20:00.000Z"
   */
  pausedAt!: string | null;

  /**
   * Time counted before the current run, in seconds.
   * @example 1200
   */
  accumulatedSeconds!: number;
}
