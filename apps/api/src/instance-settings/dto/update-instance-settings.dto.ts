import type { UpdateInstanceSettingsDto } from "@loomkeep/shared";
import { API_RATE_LIMIT_BOUNDS } from "@loomkeep/shared";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateInstanceSettingsRequestDto implements UpdateInstanceSettingsDto {
  @IsOptional()
  @IsBoolean()
  socialEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  gamificationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  publicApiEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(API_RATE_LIMIT_BOUNDS.min)
  @Max(API_RATE_LIMIT_BOUNDS.max)
  apiRateLimitFree?: number;

  @IsOptional()
  @IsInt()
  @Min(API_RATE_LIMIT_BOUNDS.min)
  @Max(API_RATE_LIMIT_BOUNDS.max)
  apiRateLimitPremium?: number;
}
