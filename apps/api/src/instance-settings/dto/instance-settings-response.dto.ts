import type {
  InstanceDomainAccountsDto,
  InstanceSettingKey,
  InstanceSettingsDto,
  InstanceSettingsValues,
} from "@loomkeep/shared/contracts";

class InstanceSettingsValuesResponseDto implements InstanceSettingsValues {
  socialEnabled!: boolean;
  chatEnabled!: boolean;
  gamificationEnabled!: boolean;
  registrationEnabled!: boolean;
  publicApiEnabled!: boolean;
  apiRateLimitFree!: number;
  apiRateLimitPremium!: number;
  updateCheckEnabled!: boolean;
  telemetryEnabled!: boolean;
  askAcquisitionSource!: boolean;
  mediaDomainEnabled!: boolean;
  gamesDomainEnabled!: boolean;
  booksDomainEnabled!: boolean;
  musicDomainEnabled!: boolean;
}

class InstanceSettingsLocksResponseDto implements Partial<
  Record<InstanceSettingKey, string>
> {
  socialEnabled?: string;
  chatEnabled?: string;
  gamificationEnabled?: string;
  registrationEnabled?: string;
  publicApiEnabled?: string;
  apiRateLimitFree?: string;
  apiRateLimitPremium?: string;
  updateCheckEnabled?: string;
  telemetryEnabled?: string;
  askAcquisitionSource?: string;
  mediaDomainEnabled?: string;
  gamesDomainEnabled?: string;
  booksDomainEnabled?: string;
  musicDomainEnabled?: string;
}

class InstanceSettingsMissingEnvResponseDto implements Partial<
  Record<InstanceSettingKey, string[]>
> {
  mediaDomainEnabled?: string[];
  gamesDomainEnabled?: string[];
  booksDomainEnabled?: string[];
  musicDomainEnabled?: string[];
}

export class InstanceDomainAccountsResponseDto implements InstanceDomainAccountsDto {
  MEDIA!: number;
  GAMES!: number;
  BOOKS!: number;
  MUSIC!: number;
}

export class InstanceSettingsResponseDto implements InstanceSettingsDto {
  values!: InstanceSettingsValuesResponseDto;
  lockedBy!: InstanceSettingsLocksResponseDto;
  missingEnv!: InstanceSettingsMissingEnvResponseDto;
}
