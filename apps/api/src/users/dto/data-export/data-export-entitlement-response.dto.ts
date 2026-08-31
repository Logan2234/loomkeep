import type { DataExportEntitlement, Plan } from "@loomkeep/shared";

export class DataExportEntitlementResponseDto implements DataExportEntitlement {
  plan!: Plan;
  source!: string | null;
  grantedAt!: string | null;
  expiresAt!: string | null;
  overrides!: Record<string, unknown>;
}
