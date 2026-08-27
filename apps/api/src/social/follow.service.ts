import {
  ErrorCode,
  type FollowRequestDto,
  NotificationType,
  ProfileAccess,
  type RelationshipDto,
  type UserSummaryDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { toUserSummaryDto } from "../users/avatar.util";
import { VisibilityService } from "./visibility.service";

const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
} as const;

@Injectable()
export class FollowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Resolves a target by username for a viewer, or throws 404. A GHOST target,
   * or one that blocked the viewer, is reported as not-found (it must stay
   * invisible). Self is allowed (the caller decides what to do with it).
   */
  private async resolveTarget(viewerId: string, username: string) {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );

    if (target.id !== viewerId) {
      if (target.profileAccess === ProfileAccess.GHOST) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.SocialUserNotFound,
        );
      }

      const blocked = await this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: target.id, blockedId: viewerId },
        },
      });
      if (blocked)
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.SocialUserNotFound,
        );
    }

    return target;
  }

  /** Follows a user: immediate on a PUBLIC profile, a request on a PRIVATE one. */
  async follow(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.resolveTarget(viewerId, username);

    if (target.id === viewerId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SocialCannotFollowSelf,
        undefined,
        "Cannot follow yourself",
      );
    }

    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { profileAccess: true },
    });

    if (
      viewer?.profileAccess === ProfileAccess.GHOST &&
      target.profileAccess !== ProfileAccess.PUBLIC
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SocialGhostPublicOnly,
        undefined,
        "A Figurant can only follow public profiles",
      );
    }

    // If the viewer blocked the target, they must unblock first.
    const blocking = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: viewerId, blockedId: target.id },
      },
    });
    if (blocking)
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SocialUnblockFirst,
        undefined,
        "Unblock this user first",
      );

    const status =
      target.profileAccess === ProfileAccess.PUBLIC ? "ACCEPTED" : "PENDING";

    const follow = await this.prisma.follow.upsert({
      where: {
        followerId_followeeId: { followerId: viewerId, followeeId: target.id },
      },
      // Never silently downgrade an accepted follow back to pending.
      update: {},
      create: { followerId: viewerId, followeeId: target.id, status },
      select: { status: true },
    });

    // Notify the target — a new accepted follow, or a pending request to review.
    // Deduped per actor so a re-follow doesn't repost. (In-app only for now.)
    if (follow.status === "ACCEPTED") {
      await this.notifyActor(target.id, viewerId, {
        type: NotificationType.FOLLOW,
        body: "vous suit",
        dedupeKey: `follow:${viewerId}`,
        urlToActor: true,
      });
    } else {
      await this.notifyActor(target.id, viewerId, {
        type: NotificationType.FOLLOW_REQUEST,
        body: "souhaite vous suivre",
        dedupeKey: `request:${viewerId}`,
      });
    }

    return this.relationship(viewerId, username);
  }

  /** Unfollows (or cancels a pending request). Idempotent. */
  async unfollow(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.resolveTarget(viewerId, username);
    await this.prisma.follow.deleteMany({
      where: { followerId: viewerId, followeeId: target.id },
    });
    return this.relationship(viewerId, username);
  }

  /** Approves a pending incoming request (identified by the Follow row id). */
  async acceptRequest(userId: string, followId: string): Promise<void> {
    const follow = await this.prisma.follow.findUnique({
      where: { id: followId },
    });

    if (
      !follow ||
      follow.followeeId !== userId ||
      follow.status !== "PENDING"
    ) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialFollowRequestNotFound,
      );
    }

    await this.prisma.follow.update({
      where: { id: followId },
      data: { status: "ACCEPTED" },
    });

    // Tell the requester their request was approved (they can now see us).
    await this.notifyActor(follow.followerId, userId, {
      type: NotificationType.FOLLOW_ACCEPTED,
      body: "a accepté votre demande",
      dedupeKey: `accept:${userId}`,
      urlToActor: true,
    });
  }

  /**
   * Posts a social notification to `recipientId` about `actorId`. The actor's
   * identity is embedded in the payload so the feed can render their avatar and
   * (optionally) link to their profile.
   */
  private async notifyActor(
    recipientId: string,
    actorId: string,
    opts: {
      type: NotificationType;
      body: string;
      dedupeKey: string;
      /** Link to the actor's profile, or a fixed url, or neither. */
      urlToActor?: boolean;
      url?: string;
    },
  ): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { username: true, displayName: true },
    });
    if (!actor) return;

    await this.notifications.create({
      userId: recipientId,
      type: opts.type,
      title: actor.displayName,
      body: opts.body,
      url: opts.urlToActor ? `/app/u/${actor.username}` : (opts.url ?? null),
      dedupeKey: opts.dedupeKey,
      data: {
        actorUsername: actor.username,
        actorDisplayName: actor.displayName,
      },
    });
  }

  /** Rejects a pending incoming request. */
  async rejectRequest(userId: string, followId: string): Promise<void> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { id: followId, followeeId: userId, status: "PENDING" },
    });
    if (count === 0)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialFollowRequestNotFound,
      );
  }

  /** Blocks a user: removes any follow edges both ways, then records the block. */
  async block(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );

    if (target.id === viewerId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SocialCannotBlockSelf,
        undefined,
        "Cannot block yourself",
      );
    }

    await this.prisma.$transaction([
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: viewerId, followeeId: target.id },
            { followerId: target.id, followeeId: viewerId },
          ],
        },
      }),
      this.prisma.block.upsert({
        where: {
          blockerId_blockedId: { blockerId: viewerId, blockedId: target.id },
        },
        update: {},
        create: { blockerId: viewerId, blockedId: target.id },
      }),
    ]);
    return this.relationship(viewerId, username);
  }

  /** Lifts a block. */
  async unblock(viewerId: string, username: string): Promise<RelationshipDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );
    await this.prisma.block.deleteMany({
      where: { blockerId: viewerId, blockedId: target.id },
    });
    return this.relationship(viewerId, username);
  }

  /** The viewer's relationship to a username. */
  async relationship(
    viewerId: string,
    username: string,
  ): Promise<RelationshipDto> {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialUserNotFound,
      );
    const relation = await this.visibility.getRelation(viewerId, target);
    return this.visibility.toRelationshipDto(relation);
  }

  /** Pending incoming follow requests awaiting the user's approval. */
  async listRequests(userId: string): Promise<FollowRequestDto[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        follower: { select: USER_SUMMARY_SELECT },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: toUserSummaryDto(r.follower),
    }));
  }

  /** Accepted followers of a user. */
  async listFollowers(userId: string): Promise<UserSummaryDto[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: userId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      select: { follower: { select: USER_SUMMARY_SELECT } },
    });
    return rows.map((r) => toUserSummaryDto(r.follower));
  }

  /** Users a user follows (accepted). */
  async listFollowing(userId: string): Promise<UserSummaryDto[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      select: { followee: { select: USER_SUMMARY_SELECT } },
    });
    return rows.map((r) => toUserSummaryDto(r.followee));
  }
}
