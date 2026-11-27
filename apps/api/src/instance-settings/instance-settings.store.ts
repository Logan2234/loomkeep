import type {
  InstanceSettingKey,
  InstanceSettingsValues,
} from "@loomkeep/shared/contracts";
import {
  API_RATE_LIMIT_BOUNDS,
  DEFAULT_INSTANCE_SETTINGS,
  INSTANCE_SETTING_ENV,
} from "@loomkeep/shared/contracts";
import { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

const logger = new Logger("InstanceSettings");
// Read on every request: say it once per variable, not once per call.
const warnedKeys = new Set<InstanceSettingKey>();

// The settings row as last read, kept here rather than behind an injected
// service so the long-standing sync helpers (isSocialEnabled & co.) keep
// their call sites. InstanceSettingsService is its only writer.
let stored: InstanceSettingsValues = { ...DEFAULT_INSTANCE_SETTINGS };

export function setStoredInstanceSettings(
  values: InstanceSettingsValues,
): void {
  stored = { ...values };
}

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off"]);

/**
 * A value it can't read is null, so the stored setting applies: reading
 * `REGISTRATION_ENABLED=0` as "open" because it isn't the word "false", or
 * a rate limit typo as NaN (which refused every public API call), turned a
 * mistake into the opposite of what the operator meant.
 */
function parseBoolean(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  return null;
}

function parseRateLimit(raw: string): number | null {
  const value = Number(raw.trim());
  return Number.isInteger(value) &&
    value >= API_RATE_LIMIT_BOUNDS.min &&
    value <= API_RATE_LIMIT_BOUNDS.max
    ? value
    : null;
}

const PARSE: {
  [K in InstanceSettingKey]: (raw: string) => InstanceSettingsValues[K] | null;
} = {
  socialEnabled: parseBoolean,
  chatEnabled: parseBoolean,
  gamificationEnabled: parseBoolean,
  registrationEnabled: parseBoolean,
  publicApiEnabled: parseBoolean,
  apiRateLimitFree: parseRateLimit,
  apiRateLimitPremium: parseRateLimit,
  updateCheckEnabled: parseBoolean,
  telemetryEnabled: parseBoolean,
  askAcquisitionSource: parseBoolean,
  mediaDomainEnabled: parseBoolean,
  gamesDomainEnabled: parseBoolean,
  booksDomainEnabled: parseBoolean,
  musicDomainEnabled: parseBoolean,
};

/** The env var's value when it's set and readable, else null. */
export function envOverride<K extends InstanceSettingKey>(
  config: ConfigService,
  key: K,
): InstanceSettingsValues[K] | null {
  const raw = config.get<string>(INSTANCE_SETTING_ENV[key]);
  if (raw === undefined || raw === "") return null;

  const value = PARSE[key](raw);

  if (value === null && !warnedKeys.has(key)) {
    warnedKeys.add(key);
    logger.warn(
      `Ignoring ${INSTANCE_SETTING_ENV[key]}="${raw}": not a value it can read`,
    );
  }

  return value;
}

/** A setting's effective value: its env var when set, else the stored row. */
export function instanceSetting<K extends InstanceSettingKey>(
  config: ConfigService,
  key: K,
): InstanceSettingsValues[K] {
  return envOverride(config, key) ?? stored[key];
}
