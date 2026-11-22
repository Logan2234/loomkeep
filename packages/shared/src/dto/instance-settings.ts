import { Domain } from "../enums";

/**
 * Instance-wide configuration an admin changes from Admin › Settings. Each
 * setting also has an env var: when set, it wins and the setting is locked
 * in the admin page — configuration as code stays authoritative.
 */
export interface InstanceSettingsValues {
  socialEnabled: boolean;
  /** Private messages between friends; only effective with `socialEnabled`. */
  chatEnabled: boolean;
  gamificationEnabled: boolean;
  registrationEnabled: boolean;
  publicApiEnabled: boolean;
  /** Requests per minute on the public API, per account. */
  apiRateLimitFree: number;
  apiRateLimitPremium: number;
  /** Daily check for a newer Loomkeep version, shown in Admin › Services. */
  updateCheckEnabled: boolean;
  /**
   * Sends the instance's random id and version along with the update check,
   * so self-hosted instances can be counted. Only effective with
   * `updateCheckEnabled`.
   */
  telemetryEnabled: boolean;
  /** "How did you hear of Loomkeep?" at the end of onboarding. */
  askAcquisitionSource: boolean;
  /**
   * Whether the instance offers each domain. One that is off, or whose
   * catalogue key is missing, disappears from the app for everyone; the
   * library entries stay, and come back when it is turned on again.
   */
  mediaDomainEnabled: boolean;
  gamesDomainEnabled: boolean;
  booksDomainEnabled: boolean;
  musicDomainEnabled: boolean;
}
export type InstanceSettingKey = keyof InstanceSettingsValues;

export const INSTANCE_SETTING_ENV: Record<InstanceSettingKey, string> = {
  socialEnabled: "SOCIAL_ENABLED",
  chatEnabled: "CHAT_ENABLED",
  gamificationEnabled: "GAMIFICATION_ENABLED",
  registrationEnabled: "REGISTRATION_ENABLED",
  publicApiEnabled: "PUBLIC_API_ENABLED",
  apiRateLimitFree: "API_RATE_LIMIT_FREE",
  apiRateLimitPremium: "API_RATE_LIMIT_PREMIUM",
  updateCheckEnabled: "UPDATE_CHECK_ENABLED",
  telemetryEnabled: "TELEMETRY_ENABLED",
  askAcquisitionSource: "ASK_ACQUISITION_SOURCE",
  mediaDomainEnabled: "MEDIA_DOMAIN_ENABLED",
  gamesDomainEnabled: "GAMES_DOMAIN_ENABLED",
  booksDomainEnabled: "BOOKS_DOMAIN_ENABLED",
  musicDomainEnabled: "MUSIC_DOMAIN_ENABLED",
};

/**
 * The switch of each domain the instance can turn off. The "coming soon"
 * placeholders have none: there is nothing behind them to turn off.
 */
export const DOMAIN_SETTING = {
  [Domain.MEDIA]: "mediaDomainEnabled",
  [Domain.GAMES]: "gamesDomainEnabled",
  [Domain.BOOKS]: "booksDomainEnabled",
  [Domain.MUSIC]: "musicDomainEnabled",
} as const satisfies Partial<Record<Domain, InstanceSettingKey>>;

export type InstanceDomain = keyof typeof DOMAIN_SETTING;
export type DomainSettingKey = (typeof DOMAIN_SETTING)[InstanceDomain];

/** What a fresh instance starts with — the same as the env defaults used to be. */
export const DEFAULT_INSTANCE_SETTINGS: InstanceSettingsValues = {
  socialEnabled: false,
  chatEnabled: false,
  gamificationEnabled: false,
  registrationEnabled: true,
  publicApiEnabled: true,
  apiRateLimitFree: 60,
  apiRateLimitPremium: 300,
  updateCheckEnabled: true,
  telemetryEnabled: true,
  askAcquisitionSource: false,
  mediaDomainEnabled: true,
  gamesDomainEnabled: true,
  booksDomainEnabled: true,
  musicDomainEnabled: true,
};

export const API_RATE_LIMIT_BOUNDS = { min: 1, max: 10_000 } as const;

export interface InstanceSettingsDto {
  values: InstanceSettingsValues;
  /** Settings pinned by an env var, with that var's name. */
  lockedBy: Partial<Record<InstanceSettingKey, string>>;
  /**
   * Settings that can't take effect for want of env vars, with those vars'
   * names: a domain without its catalogue key stays off whatever its toggle
   * says.
   */
  missingEnv: Partial<Record<InstanceSettingKey, string[]>>;
}

export type UpdateInstanceSettingsDto = Partial<InstanceSettingsValues>;
