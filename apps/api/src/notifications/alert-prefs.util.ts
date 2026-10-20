import {
  ALERTS,
  isAlertToggleable,
  type AlertKey,
  type AlertPrefs,
} from "@loomkeep/shared";
import { jsonObject } from "../common/json.util";

export function readAlertPrefs(value: unknown): AlertPrefs {
  const stored = jsonObject(value);
  const prefs: AlertPrefs = {};

  for (const key of Object.keys(ALERTS) as AlertKey[]) {
    if (!(key in stored)) continue;
    const channels = jsonObject(stored[key]);
    const preference: Partial<Record<"bell" | "push" | "email", boolean>> = {};

    for (const channel of ["bell", "push", "email"] as const) {
      if (typeof channels[channel] === "boolean")
        preference[channel] = channels[channel];
    }

    prefs[key] = preference;
  }

  return prefs;
}

/**
 * `patch` laid over `stored`, or null when it names an alert or a channel
 * with no setting, or a value that isn't a boolean.
 */
export function mergeAlertPrefs(
  stored: AlertPrefs,
  patch: Record<string, unknown>,
): AlertPrefs | null {
  const merged: Record<string, Record<string, boolean>> = Object.fromEntries(
    Object.entries(stored).map(([key, channels]) => [key, { ...channels }]),
  );

  for (const [key, channels] of Object.entries(patch)) {
    if (!(key in ALERTS) || typeof channels !== "object" || !channels) {
      return null;
    }

    for (const [channel, value] of Object.entries(channels)) {
      if (
        (channel !== "push" && channel !== "email") ||
        !isAlertToggleable(key as AlertKey, channel) ||
        typeof value !== "boolean"
      ) {
        return null;
      }

      merged[key] = { ...merged[key], [channel]: value };
    }
  }

  return merged as AlertPrefs;
}
