import type { DataExportSubscription } from "@loomkeep/shared";

export class DataExportSubscriptionResponseDto implements DataExportSubscription {
  provider!: string;
  status!: string;
  currentPeriodEnd!: string | null;
  cancelAtPeriodEnd!: boolean;
  canceledAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
