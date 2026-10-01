import type { ConfigService } from "@nestjs/config";
import { instanceSetting } from "../instance-settings/instance-settings.store";

/**
 * Whether open sign-up is allowed on this instance: Admin › Settings, unless
 * the `REGISTRATION_ENABLED` env var pins it (see InstanceSettingsService).
 * On by default; an invitation lets a sign-up through either way.
 */
export function isRegistrationEnabled(config: ConfigService): boolean {
  return instanceSetting(config, "registrationEnabled");
}
