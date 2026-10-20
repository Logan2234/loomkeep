import type { DataExportPushSubscription } from "@loomkeep/shared";

export class DataExportPushSubscriptionResponseDto implements DataExportPushSubscription {
  /**
   * The browser receiving the notifications.
   * @example "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"
   */
  userAgent!: string | null;

  /**
   * When notifications were turned on in it.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;
}
