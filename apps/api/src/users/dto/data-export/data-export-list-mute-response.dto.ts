import type { DataExportListMute } from "@loomkeep/shared";

export class DataExportListMuteResponseDto implements DataExportListMute {
  /**
   * The shared list muted.
   * @example "À voir ensemble"
   */
  listTitle!: string;

  /**
   * When it was muted.
   * @example "2026-06-01T12:00:00.000Z"
   */
  mutedAt!: string;
}
