import type {
  MyProgressionDto,
  PagedResult,
  XpHistoryDayDto,
} from "@loomkeep/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { MyProgressionResponseDto } from "./dto/my-progression-response.dto";
import { XpHistoryDayResponseDto } from "./dto/xp-history-response.dto";
import { XP_HISTORY_PAGE_DAYS, XpHistoryService } from "./xp-history.service";
import { XpService } from "./xp.service";

/**
 * Progression that belongs to the viewer alone. Separate from the social
 * profile on purpose: `SocialController` is entirely behind
 * `SocialFeatureGuard`, and the "solo first" guardrail requires XP, levels
 * and achievements to keep working on a SOCIAL_ENABLED=false instance.
 */
@Controller("gamification")
export class GamificationController {
  constructor(
    private readonly xp: XpService,
    private readonly xpHistory: XpHistoryService,
  ) {}

  /** Your own XP total — null when gamification is off. The level is derived client-side. */
  @Get("me")
  @ApiOkResponse({ type: MyProgressionResponseDto })
  async me(@CurrentUser() user: JwtPayload): Promise<MyProgressionDto> {
    return { xp: await this.xp.myXp(user.sub) };
  }

  /** Your own XP history, by day in your timezone: `limit` counts days. */
  @Get("me/history")
  @ApiOkResponse({ type: PagedResponseDto(XpHistoryDayResponseDto) })
  history(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<XpHistoryDayDto>> {
    return this.xpHistory.history(
      user.sub,
      parsePageQuery(page, limit, XP_HISTORY_PAGE_DAYS),
    );
  }
}
