import type { ConfigService } from "@nestjs/config";
import { instanceSetting } from "../instance-settings/instance-settings.store";

/**
 * Whether the social features are enabled on this instance: Admin › Settings,
 * unless the `SOCIAL_ENABLED` env var pins it (see InstanceSettingsService).
 * Off by default.
 *
 * Single source of truth: the web reads it via `GET /api/config`, and the
 * social endpoints gate on it through SocialFeatureGuard.
 */
export function isSocialEnabled(config: ConfigService): boolean {
  return instanceSetting(config, "socialEnabled");
}
