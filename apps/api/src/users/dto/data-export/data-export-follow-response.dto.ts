import type { DataExportFollow, FollowStatus } from "@loomkeep/shared";

export class DataExportFollowResponseDto implements DataExportFollow {
  /**
   * The other account.
   * @example "max"
   */
  username!: string;

  /**
   * PENDING until accepted, then ACCEPTED.
   * @example "ACCEPTED"
   */
  status!: FollowStatus;

  /**
   * When the follow was asked for.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
