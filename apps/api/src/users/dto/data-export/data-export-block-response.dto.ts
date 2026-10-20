import type { DataExportBlock } from "@loomkeep/shared";

export class DataExportBlockResponseDto implements DataExportBlock {
  /**
   * The blocked account.
   * @example "spammer42"
   */
  username!: string;

  /**
   * When it was blocked.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
