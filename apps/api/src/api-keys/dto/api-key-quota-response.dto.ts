import type { ApiKeyQuotaDto } from "@loomkeep/shared";

export class ApiKeyQuotaResponseDto implements ApiKeyQuotaDto {
  perMinute!: number;
  premiumPerMinute!: number | null;
}
