import type { OnboardingChecklistDto } from "@loomkeep/shared";
import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../../auth/decorators/current-user.decorator";
import { OnboardingChecklistResponseDto } from "./dto/onboarding-checklist-response.dto";
import { OnboardingService } from "./onboarding.service";

/**
 * [G8] The "Première séance" checklist — no `GamificationFeatureGuard`, same
 * as every other gamification endpoint: it soft-degrades to an empty,
 * already-done checklist rather than 404ing (see GamificationController).
 */
@Controller("gamification/onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @ApiOkResponse({ type: OnboardingChecklistResponseDto })
  getChecklist(@CurrentUser() user: JwtPayload): Promise<OnboardingChecklistDto> {
    return this.onboarding.getChecklist(user.sub);
  }

  @Post(":key/skip")
  @ApiOkResponse({ type: OnboardingChecklistResponseDto })
  skip(
    @CurrentUser() user: JwtPayload,
    @Param("key") key: string,
  ): Promise<OnboardingChecklistDto> {
    return this.onboarding.skip(user.sub, key);
  }
}
