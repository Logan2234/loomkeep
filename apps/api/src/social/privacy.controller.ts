import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import type {
  GhostSwitchImpactDto,
  VisibilitySettingsDto,
} from "@loomkeep/shared";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { UpdateVisibilitySettingsBody } from "./dto/update-visibility.dto";
import { PrivacyService } from "./privacy.service";
import { SocialFeatureGuard } from "./social-feature.guard";

// Own privacy config (profile access + the visibility matrix). Gated by the FF.
@UseGuards(SocialFeatureGuard)
@Controller("social/me/privacy")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload): Promise<VisibilitySettingsDto> {
    return this.privacy.getSettings(user.sub);
  }

  @Patch()
  update(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateVisibilitySettingsBody,
  ): Promise<VisibilitySettingsDto> {
    return this.privacy.updateSettings(user.sub, body);
  }

  @Get("ghost-impact")
  ghostImpact(@CurrentUser() user: JwtPayload): Promise<GhostSwitchImpactDto> {
    return this.privacy.previewGhostSwitch(user.sub);
  }
}
