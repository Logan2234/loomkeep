import type { DataExportApiKey } from "@loomkeep/shared";

export class DataExportApiKeyResponseDto implements DataExportApiKey {
  /**
   * The name it was given.
   * @example "Home Assistant"
   */
  name!: string;

  /**
   * Its last characters, to recognise it.
   * @example "a1b2"
   */
  suffix!: string;

  /**
   * What it may do.
   * @example ["library:read"]
   */
  scopes!: string[];

  /**
   * When it was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * Last time it was used.
   * @example "2026-09-30T21:00:00.000Z"
   */
  lastUsedAt!: string | null;

  /**
   * When it stops working, if it expires.
   * @example "2027-03-14T09:26:53.000Z"
   */
  expiresAt!: string | null;
}
