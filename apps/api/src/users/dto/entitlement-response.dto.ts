import type { EntitlementDto } from "../../entitlements/entitlement.types";

export class EntitlementResponseDto implements EntitlementDto {
  isPremium!: boolean;
}
