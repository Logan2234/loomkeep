import type {
  ActivityEventDto,
  FollowRequestDto,
  PagedResult,
  RelationshipDto,
  SocialProfileDto,
  UserSummaryDto,
} from "@loomkeep/shared";
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { UserSummaryResponseDto } from "../common/dto/user-summary-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { ActivityService, FEED_PAGE_SIZE } from "./activity.service";
import { ActivityEventResponseDto } from "./dto/activity-event-response.dto";
import { FollowRequestResponseDto } from "./dto/follow-request-response.dto";
import { RelationshipResponseDto } from "./dto/relationship-response.dto";
import { SocialProfileResponseDto } from "./dto/social-profile-response.dto";
import { FollowService } from "./follow.service";
import { ProfileService } from "./profile.service";
import { SocialFeatureGuard } from "./social-feature.guard";

// The whole controller is gated behind SOCIAL_ENABLED (404 when off).
@UseGuards(SocialFeatureGuard)
@Controller("social")
export class SocialController {
  constructor(
    private readonly follow: FollowService,
    private readonly profiles: ProfileService,
    private readonly activity: ActivityService,
  ) {}

  /** Home feed: aggregated milestones from the users you follow. */
  @Get("feed")
  feed(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<ActivityEventDto>> {
    const parsed = parsePageQuery(page, limit, FEED_PAGE_SIZE);
    return this.activity.homeFeed(user.sub, parsed.page, parsed.limit);
  }

  /** A short home-page teaser of the home feed. */
  @Get("feed/preview")
  @ApiOkResponse({ type: ActivityEventResponseDto, isArray: true })
  feedPreview(@CurrentUser() user: JwtPayload): Promise<ActivityEventDto[]> {
    return this.activity.homePreview(user.sub);
  }

  /** A user's detailed activity timeline (visibility-filtered). */
  @Get("users/:username/activity")
  async userActivity(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<ActivityEventDto>> {
    const target = await this.profiles.resolveTimelineTarget(
      user.sub,
      username,
    );
    // A locked (private, unfollowed) profile exposes no activity.
    if (!target) return { items: [], hasMore: false };
    const parsed = parsePageQuery(page, limit, FEED_PAGE_SIZE);
    return this.activity.profileTimeline(
      user.sub,
      target,
      parsed.page,
      parsed.limit,
    );
  }

  @Get("requests")
  @ApiOkResponse({ type: FollowRequestResponseDto, isArray: true })
  requests(@CurrentUser() user: JwtPayload): Promise<FollowRequestDto[]> {
    return this.follow.listRequests(user.sub);
  }

  @Post("requests/:id/accept")
  accept(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.follow.acceptRequest(user.sub, id);
  }

  @Post("requests/:id/reject")
  reject(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    return this.follow.rejectRequest(user.sub, id);
  }

  /** A user's followers (gated like their profile content). */
  @Get("users/:username/followers")
  @ApiOkResponse({ type: UserSummaryResponseDto, isArray: true })
  userFollowers(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<UserSummaryDto[]> {
    return this.profiles.listFollowers(user.sub, username);
  }

  /** Accounts a user follows (gated like their profile content). */
  @Get("users/:username/following")
  @ApiOkResponse({ type: UserSummaryResponseDto, isArray: true })
  userFollowing(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<UserSummaryDto[]> {
    return this.profiles.listFollowing(user.sub, username);
  }

  @Get("users/:username")
  @ApiOkResponse({ type: SocialProfileResponseDto })
  profile(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<SocialProfileDto> {
    return this.profiles.getProfile(user.sub, username);
  }

  @Post("users/:username/follow")
  @ApiCreatedResponse({ type: RelationshipResponseDto })
  followUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.follow(user.sub, username);
  }

  @Delete("users/:username/follow")
  @ApiOkResponse({ type: RelationshipResponseDto })
  unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.unfollow(user.sub, username);
  }

  @Post("users/:username/block")
  @ApiCreatedResponse({ type: RelationshipResponseDto })
  blockUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.block(user.sub, username);
  }

  @Delete("users/:username/block")
  @ApiOkResponse({ type: RelationshipResponseDto })
  unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.unblock(user.sub, username);
  }
}
