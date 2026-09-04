import type { MyProgressionDto } from "@loomkeep/shared";
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { MyProgressionResponseDto } from "./dto/my-progression-response.dto";
import { XpService } from "./xp.service";

/**
 * Progression that belongs to the viewer alone. Separate from the social
 * profile on purpose: `SocialController` is entirely behind
 * `SocialFeatureGuard`, and the "solo first" guardrail requires XP, levels
 * and achievements to keep working on a SOCIAL_ENABLED=false instance.
 */
@Controller("gamification")
export class GamificationController {
  constructor(private readonly xp: XpService) {}

  /** Your own XP total — null when gamification is off. The level is derived client-side. */
  @Get("me")
  @ApiOkResponse({ type: MyProgressionResponseDto })
  async me(@CurrentUser() user: JwtPayload): Promise<MyProgressionDto> {
    return { xp: await this.xp.myXp(user.sub) };
  }
}
