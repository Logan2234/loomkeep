import type { Domain } from "./enums";

export const FeatureFlag = { PREMIUM_FEATURES: "premium-features" } as const;

export function maintenanceFlag(domain: Domain): `MAINTENANCE_${Domain}` {
  return `MAINTENANCE_${domain}`;
}
