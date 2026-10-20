import type { DataExportSession } from "@loomkeep/shared";

export class DataExportSessionResponseDto implements DataExportSession {
  /**
   * The browser it was opened in.
   * @example "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Firefox/131.0"
   */
  userAgent!: string | null;

  /**
   * When it was opened.
   * @example "2026-09-01T08:00:00.000Z"
   */
  createdAt!: string;

  /**
   * Last time it was used.
   * @example "2026-10-03T21:00:00.000Z"
   */
  lastUsedAt!: string;

  /**
   * When it ends without use.
   * @example "2026-11-01T08:00:00.000Z"
   */
  expiresAt!: string;
}
