import {
  type CatalogSource,
  COMMENT_TEXT_MAX_LENGTH,
  type CommentTargetType,
  ErrorCode,
  GameSource,
  GameStatus,
  type MediaType,
  MESSAGE_TEXT_MAX_LENGTH,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ChatService } from "../chat/chat.service";
import { CommentService } from "../comments/comment.service";
import { AppException } from "../common/app.exception";
import { GameLibraryService } from "../games/game-library.service";
import { LibraryService } from "../library/library.service";
import {
  type ActionClaims,
  NotificationAction,
  verifyAction,
} from "../notifications/notification-action";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { FollowService } from "../social/follow.service";
import { isSuspended } from "../users/suspension.util";

const invalid = () =>
  new AppException(HttpStatus.NOT_FOUND, ErrorCode.NotificationActionInvalid);

/**
 * A button pressed on an Android notification (MOB-17), done for the
 * account the token was minted for, through the same services and checks
 * as in the app. No session: the token is the credential, and it stops
 * working once its push subscription is gone.
 */
@Injectable()
export class NotificationActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly follows: FollowService,
    private readonly comments: CommentService,
    private readonly library: LibraryService,
    private readonly games: GameLibraryService,
    private readonly notifications: NotificationService,
  ) {}

  async perform(token: string, text?: string): Promise<void> {
    const claims = verifyAction(token);
    if (!claims) throw invalid();

    const subscription = await this.prisma.pushSubscription.findUnique({
      where: { id: claims.subscriptionId },
      select: { user: { select: { id: true, suspendedUntil: true } } },
    });
    if (!subscription || isSuspended(subscription.user)) throw invalid();
    const userId = subscription.user.id;

    await this.dispatch(userId, claims, text?.trim());

    if (claims.notificationId) {
      // Already gone (deleted from the bell) is fine: the action is done.
      await this.notifications
        .markRead(userId, claims.notificationId)
        .catch(() => undefined);
    }
  }

  private async dispatch(
    userId: string,
    { action, target }: ActionClaims,
    text: string | undefined,
  ): Promise<void> {
    switch (action) {
      case NotificationAction.CHAT_REPLY:
        await this.chat.send(
          userId,
          target.conversationId!,
          requireText(text, MESSAGE_TEXT_MAX_LENGTH),
        );
        return;
      case NotificationAction.CHAT_READ:
        await this.chat.markRead(userId, target.conversationId!);
        return;
      case NotificationAction.FOLLOW_ACCEPT:
        await this.follows.acceptRequest(userId, target.followId!);
        return;
      case NotificationAction.FOLLOW_REJECT:
        await this.follows.rejectRequest(userId, target.followId!);
        return;
      case NotificationAction.FOLLOW_BACK:
        await this.follows.follow(userId, target.username!);
        return;
      case NotificationAction.COMMENT_REPLY:
        await this.comments.create(userId, {
          targetType: target.targetType as CommentTargetType,
          targetId: target.targetId!,
          parentId: target.parentId,
          text: requireText(text, COMMENT_TEXT_MAX_LENGTH),
        });
        return;
      case NotificationAction.PLAN_WORK:
        if (target.domain === "game") {
          await this.games.upsertEntry(userId, {
            source: GameSource.IGDB,
            sourceId: target.sourceId!,
            status: GameStatus.BACKLOG,
          });
        } else {
          await this.library.upsertEntry(userId, {
            source: target.source as CatalogSource,
            sourceId: target.sourceId!,
            type: target.type as MediaType,
            status: "PLANNED",
          });
        }

        return;
      case NotificationAction.MARK_READ:
        // perform() marks the notification read after every action.
        return;
    }
  }
}

// The controller's DTO only caps the longest kind of reply.
function requireText(text: string | undefined, maxLength: number): string {
  if (!text || text.length > maxLength) {
    throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.ValidationFailed);
  }

  return text;
}
