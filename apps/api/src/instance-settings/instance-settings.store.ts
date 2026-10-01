import type {
  InstanceSettingKey,
  InstanceSettingsValues,
} from "@loomkeep/shared";
import {
  DEFAULT_INSTANCE_SETTINGS,
  INSTANCE_SETTING_ENV,
} from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";

// The settings row as last read, kept here rather than behind an injected
// service so the long-standing sync helpers (isSocialEnabled & co.) keep
// their call sites. InstanceSettingsService is its only writer.
let stored: InstanceSettingsValues = { ...DEFAULT_INSTANCE_SETTINGS };

export function setStoredInstanceSettings(
  values: InstanceSettingsValues,
): void {
  stored = { ...values };
}

const PARSE: {
  [K in InstanceSettingKey]: (raw: string) => InstanceSettingsValues[K];
} = {
  socialEnabled: (raw) => raw === "true",
  gamificationEnabled: (raw) => raw === "true",
  // Kept from the env-only days: open unless explicitly "false".
  registrationEnabled: (raw) => raw !== "false",
  publicApiEnabled: (raw) => raw !== "false",
  apiRateLimitFree: (raw) => Number(raw),
  apiRateLimitPremium: (raw) => Number(raw),
};

/** The env var's value when it's set, else null. */
export function envOverride<K extends InstanceSettingKey>(
  config: ConfigService,
  key: K,
): InstanceSettingsValues[K] | null {
  const raw = config.get<string>(INSTANCE_SETTING_ENV[key]);
  return raw === undefined || raw === "" ? null : PARSE[key](raw);
}

/** A setting's effective value: its env var when set, else the stored row. */
export function instanceSetting<K extends InstanceSettingKey>(
  config: ConfigService,
  key: K,
): InstanceSettingsValues[K] {
  return envOverride(config, key) ?? stored[key];
}
