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
};

/** What a fresh instance starts with — the same as the env defaults used to be. */
export const DEFAULT_INSTANCE_SETTINGS: InstanceSettingsValues = {
  socialEnabled: false,
  chatEnabled: false,
  gamificationEnabled: false,
  registrationEnabled: true,
  publicApiEnabled: true,
  apiRateLimitFree: 60,
  apiRateLimitPremium: 300,
};

export const API_RATE_LIMIT_BOUNDS = { min: 1, max: 10_000 } as const;

export interface InstanceSettingsDto {
  values: InstanceSettingsValues;
  /** Settings pinned by an env var, with that var's name. */
  lockedBy: Partial<Record<InstanceSettingKey, string>>;
}

export type UpdateInstanceSettingsDto = Partial<InstanceSettingsValues>;
