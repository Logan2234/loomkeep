import type { ActivityFeedTokenDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import {
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { AppException } from "../../common/app.exception";
import { SocialFeatureGuard } from "../../social/social-feature.guard";
import { buildAtomFeed } from "../calendar/feed.util";
import { EeLicenseGuard } from "../licensing/ee-license.guard";
import { ActivityFeedService } from "./activity-feed.service";
import { ActivityFeedTokenResponseDto } from "./dto/activity-feed-token-response.dto";

/**
 * 404s when either social features or `ee/` are off for this instance,
 * rather than 403 — same "behaves as absent" convention as `SocialFeatureGuard`
 * and `EeLicenseGuard` individually.
 */
@UseGuards(SocialFeatureGuard, EeLicenseGuard)
@Controller()
export class ActivityFeedController {
  constructor(private readonly activityFeed: ActivityFeedService) {}

  /**
   * Public (no auth) so feed readers can poll it directly by URL — they
   * can't send an Authorization header. Gated by the unguessable per-user
   * `activityFeedToken` instead, same pattern as the calendar feed.
   */
  @Public()
  @Get("social/activity.atom")
  async getActivityAtom(
    @Query("token") token: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const feed = token ? await this.activityFeed.getFeed(token) : null;

    if (!feed) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialActivityFeedUnavailable,
      );
    }

    reply
      .header("Content-Type", "application/atom+xml; charset=utf-8")
      .send(buildAtomFeed(feed));
  }

  @Get("users/me/activity-feed-token")
  @ApiOkResponse({ type: ActivityFeedTokenResponseDto })
  getToken(@CurrentUser() payload: JwtPayload): Promise<ActivityFeedTokenDto> {
    return this.activityFeed.getToken(payload.sub);
  }

  /** Issues a new token, invalidating any previously shared feed link. */
  @Post("users/me/activity-feed-token/regenerate")
  @ApiCreatedResponse({ type: ActivityFeedTokenResponseDto })
  regenerateToken(
    @CurrentUser() payload: JwtPayload,
  ): Promise<ActivityFeedTokenDto> {
    return this.activityFeed.regenerateToken(payload.sub);
  }
}
