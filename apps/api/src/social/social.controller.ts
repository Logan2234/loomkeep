import type {
  ActivityEventDto,
  ActivityFeedDto,
  FollowRequestDto,
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
import {
  type JwtPayload,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { ActivityService } from "./activity.service";
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
    @Query("cursor") cursor?: string,
  ): Promise<ActivityFeedDto> {
    return this.activity.homeFeed(user.sub, cursor);
  }

  /** A short home-page teaser of the home feed. */
  @Get("feed/preview")
  feedPreview(@CurrentUser() user: JwtPayload): Promise<ActivityEventDto[]> {
    return this.activity.homePreview(user.sub);
  }

  /** A user's detailed activity timeline (visibility-filtered). */
  @Get("users/:username/activity")
  async userActivity(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
    @Query("cursor") cursor?: string,
  ): Promise<ActivityFeedDto> {
    const target = await this.profiles.resolveTimelineTarget(
      user.sub,
      username,
    );
    // A locked (private, unfollowed) profile exposes no activity.
    if (!target) return { events: [], nextCursor: null };
    return this.activity.profileTimeline(user.sub, target, cursor);
  }

  @Get("requests")
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
  userFollowers(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<UserSummaryDto[]> {
    return this.profiles.listFollowers(user.sub, username);
  }

  /** Accounts a user follows (gated like their profile content). */
  @Get("users/:username/following")
  userFollowing(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<UserSummaryDto[]> {
    return this.profiles.listFollowing(user.sub, username);
  }

  @Get("users/:username")
  profile(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<SocialProfileDto> {
    return this.profiles.getProfile(user.sub, username);
  }

  @Post("users/:username/follow")
  followUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.follow(user.sub, username);
  }

  @Delete("users/:username/follow")
  unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.unfollow(user.sub, username);
  }

  @Post("users/:username/block")
  blockUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.block(user.sub, username);
  }

  @Delete("users/:username/block")
  unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
  ): Promise<RelationshipDto> {
    return this.follow.unblock(user.sub, username);
  }
}
