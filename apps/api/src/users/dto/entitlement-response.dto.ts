import type { EntitlementDto } from "@loomkeep/shared";

export class EntitlementResponseDto implements EntitlementDto {
  isPremium!: boolean;
}
