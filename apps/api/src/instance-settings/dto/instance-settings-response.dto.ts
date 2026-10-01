import type {
  InstanceSettingKey,
  InstanceSettingsDto,
  InstanceSettingsValues,
} from "@loomkeep/shared";

class InstanceSettingsValuesResponseDto implements InstanceSettingsValues {
  socialEnabled!: boolean;
  gamificationEnabled!: boolean;
  registrationEnabled!: boolean;
  publicApiEnabled!: boolean;
  apiRateLimitFree!: number;
  apiRateLimitPremium!: number;
}

class InstanceSettingsLocksResponseDto implements Partial<
  Record<InstanceSettingKey, string>
> {
  socialEnabled?: string;
  gamificationEnabled?: string;
  registrationEnabled?: string;
  publicApiEnabled?: string;
  apiRateLimitFree?: string;
  apiRateLimitPremium?: string;
}

export class InstanceSettingsResponseDto implements InstanceSettingsDto {
  values!: InstanceSettingsValuesResponseDto;
  lockedBy!: InstanceSettingsLocksResponseDto;
}
