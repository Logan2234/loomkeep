import type { DataExportPasskey } from "@loomkeep/shared";

export class DataExportPasskeyResponseDto implements DataExportPasskey {
  /**
   * The name it was given.
   * @example "iPhone"
   */
  name!: string;

  /**
   * "singleDevice" or "multiDevice" (synced).
   * @example "multiDevice"
   */
  deviceType!: string;

  /**
   * When it was added.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * Last sign-in with it.
   * @example "2026-09-30T21:00:00.000Z"
   */
  lastUsedAt!: string | null;
}
