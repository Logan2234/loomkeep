import type { ProfileAccess, VisibilitySettingsDto } from "@loomkeep/shared";
import { VisibilitySettingItemResponseDto } from "./visibility-setting-item-response.dto";

export class VisibilitySettingsResponseDto implements VisibilitySettingsDto {
  profileAccess!: ProfileAccess;
  settings!: VisibilitySettingItemResponseDto[];
}
