import type { DataExportSubscription } from "@loomkeep/shared";

export class DataExportSubscriptionResponseDto implements DataExportSubscription {
  /**
   * The payment provider.
   * @example "stripe"
   */
  provider!: string;

  /**
   * The subscription's state at the provider.
   * @example "active"
   */
  status!: string;

  /**
   * End of the paid period.
   * @example "2026-10-14T00:00:00.000Z"
   */
  currentPeriodEnd!: string | null;

  /**
   * Ends at the end of the period instead of renewing.
   * @example false
   */
  cancelAtPeriodEnd!: boolean;

  /**
   * When it was cancelled.
   * @example "2026-09-20T10:00:00.000Z"
   */
  canceledAt!: string | null;

  /**
   * When it started.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When it last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;
}
