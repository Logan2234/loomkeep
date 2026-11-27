import type { ApiKeyQuotaDto } from "@loomkeep/shared/contracts";

export class ApiKeyQuotaResponseDto implements ApiKeyQuotaDto {
  perMinute!: number;
  premiumPerMinute!: number | null;
}
