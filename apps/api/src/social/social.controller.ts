import {
  type ActivityEventDto,
  type ConnectionDto,
  type FollowRequestDto,
  type ListItemTargetType,
  type PagedResult,
  type RelationshipDto,
  type SocialProfileDto,
  type UserSummaryDto,
  type WorkFriendsDto,
  Domain,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { UserSummaryResponseDto } from "../common/dto/user-summary-response.dto";
import { DEFAULT_PAGE_SIZE, parsePageQuery } from "../common/pagination.util";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { REPORT_THROTTLE } from "../common/throttle.constants";
import { CreateReportBody } from "../reports/dto/create-report.dto";
import { ReportService } from "../reports/report.service";
import { ActivityService, FEED_PAGE_SIZE } from "./activity.service";
import { ActivityEventResponseDto } from "./dto/activity-event-response.dto";
import { ConnectionResponseDto } from "./dto/connection-response.dto";
import { FollowRequestResponseDto } from "./dto/follow-request-response.dto";
import { RelationshipResponseDto } from "./dto/relationship-response.dto";
import { SocialProfileResponseDto } from "./dto/social-profile-response.dto";
import { WorkFriendsResponseDto } from "./dto/work-friends-response.dto";
import { FollowService } from "./follow.service";
import { ProfileService } from "./profile.service";
import { SocialFeatureGuard } from "./social-feature.guard";
import { WorkFriendsService } from "./work-friends.service";

// The whole controller is gated behind SOCIAL_ENABLED (404 when off).
const WORK_TYPES: readonly ListItemTargetType[] = [
  "MEDIA",
  "GAME",
  "BOOK",
  "MUSIC",
];

@UseGuards(SocialFeatureGuard)
@Controller("social")
export class SocialController {
  constructor(
    private readonly follow: FollowService,
    private readonly profiles: ProfileService,
    private readonly activity: ActivityService,
    private readonly reports: ReportService,
    private readonly workFriendsService: WorkFriendsService,
  ) {}

  /**
   * Home feed: aggregated milestones from the users you follow, optionally
   * narrowed to one `domain`.
   */
  @Get("feed")
  @ApiOkResponse({ type: PagedResponseDto(ActivityEventResponseDto) })
  feed(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("domain") domain?: string,
  ): Promise<PagedResult<ActivityEventDto>> {
    const parsed = parsePageQuery(page, limit, FEED_PAGE_SIZE);
    return this.activity.homeFeed(
      user.sub,
      parsed,
      domain
        ? parseEnumParam(domain, Object.values(Domain), "domain")
        : undefined,
    );
  }

  /** A user's detailed activity timeline (visibility-filtered). */
  @Get("users/:username/activity")
  @ApiOkResponse({ type: PagedResponseDto(ActivityEventResponseDto) })
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
    return this.activity.profileTimeline(user.sub, target, parsed);
  }

  /** The friends who track a work, for its page: progress and rating. */
  @Get("works/:type/:id/friends")
  @ApiOkResponse({ type: WorkFriendsResponseDto })
  workFriends(
    @CurrentUser() user: JwtPayload,
    @Param("type") type: string,
    @Param("id") id: string,
  ): Promise<WorkFriendsDto> {
    return this.workFriendsService.forWork(
      user.sub,
      parseEnumParam<ListItemTargetType>(type, WORK_TYPES, "type"),
      id,
    );
  }

  @Get("requests")
  @ApiOkResponse({ type: FollowRequestResponseDto, isArray: true })
  requests(@CurrentUser() user: JwtPayload): Promise<FollowRequestDto[]> {
    return this.follow.listRequests(user.sub);
  }

  /** The accounts the caller has blocked, so they can restore access later. */
  @Get("blocked")
  @ApiOkResponse({ type: PagedResponseDto(UserSummaryResponseDto) })
  blocked(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<UserSummaryDto>> {
    const parsed = parsePageQuery(page, limit, DEFAULT_PAGE_SIZE);
    return this.follow.listBlocked(user.sub, parsed);
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
  @ApiOkResponse({ type: ConnectionResponseDto, isArray: true })
  userFollowers(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<ConnectionDto[]> {
    return this.profiles.listFollowers(user.sub, username);
  }

  /** Accounts a user follows (gated like their profile content). */
  @Get("users/:username/following")
  @ApiOkResponse({ type: ConnectionResponseDto, isArray: true })
  userFollowing(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<ConnectionDto[]> {
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

  /** Removes this user from the caller's followers, without telling them. */
  @Delete("users/:username/follower")
  @ApiOkResponse({ type: RelationshipResponseDto })
  removeFollower(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.removeFollower(user.sub, username);
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

  @Post("users/:username/report")
  @Throttle(REPORT_THROTTLE)
  async reportUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
    @Body() body: CreateReportBody,
  ): Promise<void> {
    const targetId = await this.profiles.reportTargetId(user.sub, username);
    await this.reports.create(
      user.sub,
      "USER",
      targetId,
      body.category,
      body.motif,
      body.reason,
      body.profilePart,
    );
  }
}
