import type {
  GhostSwitchImpactDto,
  VisibilitySettingsDto,
} from "@loomkeep/shared";
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { GhostSwitchImpactResponseDto } from "./dto/ghost-switch-impact-response.dto";
import { UpdateVisibilitySettingsBody } from "./dto/update-visibility.dto";
import { VisibilitySettingsResponseDto } from "./dto/visibility-settings-response.dto";
import { PrivacyService } from "./privacy.service";
import { SocialFeatureGuard } from "./social-feature.guard";

// Own privacy config (profile access + the visibility matrix). Gated by the FF.
@UseGuards(SocialFeatureGuard)
@Controller("social/me/privacy")
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  @ApiOkResponse({ type: VisibilitySettingsResponseDto })
  get(@CurrentUser() user: JwtPayload): Promise<VisibilitySettingsDto> {
    return this.privacy.getSettings(user.sub);
  }

  @Patch()
  @ApiOkResponse({ type: VisibilitySettingsResponseDto })
  update(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateVisibilitySettingsBody,
  ): Promise<VisibilitySettingsDto> {
    return this.privacy.updateSettings(user.sub, body);
  }

  @Get("ghost-impact")
  @ApiOkResponse({ type: GhostSwitchImpactResponseDto })
  ghostImpact(@CurrentUser() user: JwtPayload): Promise<GhostSwitchImpactDto> {
    return this.privacy.previewGhostSwitch(user.sub);
  }
}
