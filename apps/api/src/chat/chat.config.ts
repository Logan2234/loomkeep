import type { ConfigService } from "@nestjs/config";
import { instanceSetting } from "../instance-settings/instance-settings.store";
import { isSocialEnabled } from "../social/social.config";

/**
 * Whether friends can message each other: its own instance setting, so an
 * instance can open the social features without hosting private messages it
 * would then have to moderate. Meaningless without social, hence both.
 */
export function isChatEnabled(config: ConfigService): boolean {
  return isSocialEnabled(config) && instanceSetting(config, "chatEnabled");
}
