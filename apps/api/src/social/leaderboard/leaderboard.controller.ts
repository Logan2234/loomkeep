import type { LeaderboardDto } from "@loomkeep/shared";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import {
  CurrentUser,
  type JwtPayload,
} from "../../auth/decorators/current-user.decorator";
import { GamificationFeatureGuard } from "../../gamification/gamification-feature.guard";
import { SocialFeatureGuard } from "../social-feature.guard";
import { LeaderboardQueryDto } from "./dto/leaderboard-query.dto";
import { LeaderboardResponseDto } from "./dto/leaderboard-response.dto";
import { LeaderboardService } from "./leaderboard.service";

/**
 * [G7] Ranks by XP. Gated behind BOTH SocialFeatureGuard and
 * GamificationFeatureGuard — a leaderboard needs XP to exist AND other users
 * to rank against, so either flag being off 404s it, same as every other
 * social surface.
 */
@Controller("leaderboard")
@UseGuards(SocialFeatureGuard, GamificationFeatureGuard)
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  @ApiOkResponse({ type: LeaderboardResponseDto })
  get(
    @CurrentUser() user: JwtPayload,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardDto> {
    return this.leaderboard.getLeaderboard(
      user.sub,
      query.scope ?? "global",
      query.period ?? "month",
    );
  }
}
