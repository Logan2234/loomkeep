import type { DataExportEntitlement, Plan } from "@loomkeep/shared";

export class DataExportEntitlementResponseDto implements DataExportEntitlement {
  /**
   * FREE or PREMIUM.
   * @example "FREE"
   */
  plan!: Plan;

  /**
   * Where the plan comes from.
   * @example "admin"
   */
  source!: string | null;

  /**
   * When it was granted.
   * @example "2026-03-14T09:26:53.000Z"
   */
  grantedAt!: string | null;

  /**
   * When it ends.
   * @example "2027-03-14T00:00:00.000Z"
   */
  expiresAt!: string | null;

  /** Per-account adjustments to the plan's limits. */
  overrides!: Record<string, unknown>;
}
