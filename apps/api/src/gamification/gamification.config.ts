import type { ConfigService } from "@nestjs/config";
import { instanceSetting } from "../instance-settings/instance-settings.store";

/**
 * Whether gamification (XP, levels, achievements, leaderboard) is enabled on
 * this instance: Admin › Settings, unless the `GAMIFICATION_ENABLED` env var
 * pins it (see InstanceSettingsService). Off by default.
 */
export function isGamificationEnabled(config: ConfigService): boolean {
  return instanceSetting(config, "gamificationEnabled");
}
