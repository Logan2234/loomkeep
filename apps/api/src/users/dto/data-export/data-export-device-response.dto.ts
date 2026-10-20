import type { DataExportDevice } from "@loomkeep/shared";

export class DataExportDeviceResponseDto implements DataExportDevice {
  /**
   * An opaque id of the device.
   * @example "2f6c1d0e9a"
   */
  deviceKey!: string;

  /**
   * The browser it identified as.
   * @example "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"
   */
  userAgent!: string | null;

  /**
   * First sign-in from it.
   * @example "2026-03-14T09:26:53.000Z"
   */
  firstSeenAt!: string;

  /**
   * Last activity from it.
   * @example "2026-09-30T21:00:00.000Z"
   */
  lastSeenAt!: string;
}
