import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  COMMENT_TEXT_MAX_LENGTH,
  MESSAGE_TEXT_MAX_LENGTH,
} from "@loomkeep/shared/contracts";
import { GameSource, GameStatus } from "@loomkeep/shared/enums";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatService } from "../chat/chat.service";
import type { CommentService } from "../comments/comment.service";
import type { GameLibraryService } from "../games/game-library.service";
import type { MediaLibraryService } from "../media/media-library.service";
import {
  type ActionClaims,
  NotificationAction,
  signAction,
} from "../notifications/notification-action";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { FollowService } from "../social/follow.service";
import { NotificationActionService } from "./notification-action.service";

// POST /notifications/actions is public: the signed token is the only
// credential, so what it may do on whose behalf is locked down here.

const ACCOUNT = { id: "user-1", suspendedUntil: null as Date | null };

function make(subscription: unknown = { user: ACCOUNT }) {
  const prisma = {
    pushSubscription: { findUnique: vi.fn().mockResolvedValue(subscription) },
  };
  const chat = { send: vi.fn(), markRead: vi.fn() };
  const follows = {
    acceptRequest: vi.fn(),
    rejectRequest: vi.fn(),
    follow: vi.fn(),
  };
  const comments = { create: vi.fn() };
  const library = { upsertEntry: vi.fn() };
  const games = { upsertEntry: vi.fn() };
  const notifications = { markRead: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationActionService(
    prisma as unknown as PrismaService,
    chat as unknown as ChatService,
    follows as unknown as FollowService,
    comments as unknown as CommentService,
    library as unknown as MediaLibraryService,
    games as unknown as GameLibraryService,
    notifications as unknown as NotificationService,
  );
  return {
    service,
    prisma,
    chat,
    follows,
    comments,
    library,
    games,
    notifications,
  };
}

const token = (claims: Partial<Omit<ActionClaims, "expiresAt">> = {}) =>
  signAction({
    action: NotificationAction.FOLLOW_ACCEPT,
    target: { followId: "follow-1" },
    subscriptionId: "sub-1",
    notificationId: "notif-1",
    ...claims,
  });

const rejectsWith = (promise: Promise<unknown>, code: ErrorCode) =>
  expect(promise).rejects.toMatchObject({ code });

let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "access-secret";
});

afterEach(() => {
  process.env.JWT_ACCESS_SECRET = previousSecret;
});

describe("NotificationActionService.perform — who it acts for", () => {
  it("refuses a token that doesn't verify, before touching anything", async () => {
    const { service, prisma, follows } = make();

    await rejectsWith(
      service.perform(`${token()}x`),
      ErrorCode.NotificationActionInvalid,
    );
    expect(prisma.pushSubscription.findUnique).not.toHaveBeenCalled();
    expect(follows.acceptRequest).not.toHaveBeenCalled();
  });

  it("refuses once the push subscription it was minted for is gone", async () => {
    const { service, follows } = make(null);

    await rejectsWith(
      service.perform(token()),
      ErrorCode.NotificationActionInvalid,
    );
    expect(follows.acceptRequest).not.toHaveBeenCalled();
  });

  it("refuses for a suspended account", async () => {
    const { service, follows } = make({
      user: { ...ACCOUNT, suspendedUntil: new Date(Date.now() + 60_000) },
    });

    await rejectsWith(
      service.perform(token()),
      ErrorCode.NotificationActionInvalid,
    );
    expect(follows.acceptRequest).not.toHaveBeenCalled();
  });

  it("acts for the subscription's owner, then marks the notification read", async () => {
    const { service, prisma, follows, notifications } = make();

    await service.perform(token());

    expect(prisma.pushSubscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sub-1" } }),
    );
    expect(follows.acceptRequest).toHaveBeenCalledWith("user-1", "follow-1");
    expect(notifications.markRead).toHaveBeenCalledWith("user-1", "notif-1");
  });

  it("leaves the notification alone when the action fails", async () => {
    const { service, follows, notifications } = make();
    follows.acceptRequest.mockRejectedValue(new Error("gone"));

    await expect(service.perform(token())).rejects.toThrow("gone");
    expect(notifications.markRead).not.toHaveBeenCalled();
  });

  it("still succeeds when the notification was already deleted", async () => {
    const { service, notifications } = make();
    notifications.markRead.mockRejectedValue(new Error("not found"));

    await expect(service.perform(token())).resolves.toBeUndefined();
  });
});

describe("NotificationActionService.perform — replies", () => {
  // Signed per test: the secret is only set in beforeEach.
  const chatReply = () =>
    token({
      action: NotificationAction.CHAT_REPLY,
      target: { conversationId: "conv-1" },
    });

  it("sends the trimmed reply to the conversation", async () => {
    const { service, chat } = make();

    await service.perform(chatReply(), "  on my way  ");

    expect(chat.send).toHaveBeenCalledWith("user-1", "conv-1", "on my way");
  });

  it.each([
    ["no text", undefined],
    ["only spaces", "   "],
    ["a message over the limit", "a".repeat(MESSAGE_TEXT_MAX_LENGTH + 1)],
  ])("refuses a reply with %s", async (_, text) => {
    const { service, chat } = make();

    await rejectsWith(
      service.perform(chatReply(), text),
      ErrorCode.ValidationFailed,
    );
    expect(chat.send).not.toHaveBeenCalled();
  });

  it("caps a comment reply at the comment limit, under the message one", async () => {
    const { service, comments } = make();
    const commentReply = token({
      action: NotificationAction.COMMENT_REPLY,
      target: { targetType: "MEDIA", targetId: "media-1", parentId: "c-1" },
    });

    await rejectsWith(
      service.perform(commentReply, "a".repeat(COMMENT_TEXT_MAX_LENGTH + 1)),
      ErrorCode.ValidationFailed,
    );
    await service.perform(commentReply, "agreed");

    expect(comments.create).toHaveBeenCalledOnce();
    expect(comments.create).toHaveBeenCalledWith("user-1", {
      targetType: "MEDIA",
      targetId: "media-1",
      parentId: "c-1",
      text: "agreed",
    });
  });
});

describe("NotificationActionService.perform — every other action", () => {
  it("routes the follow buttons to their own calls", async () => {
    const { service, follows } = make();

    await service.perform(
      token({
        action: NotificationAction.FOLLOW_REJECT,
        target: { followId: "f-2" },
      }),
    );
    await service.perform(
      token({
        action: NotificationAction.FOLLOW_BACK,
        target: { username: "bob" },
      }),
    );

    expect(follows.rejectRequest).toHaveBeenCalledWith("user-1", "f-2");
    expect(follows.follow).toHaveBeenCalledWith("user-1", "bob");
  });

  it("marks a conversation read", async () => {
    const { service, chat } = make();

    await service.perform(
      token({
        action: NotificationAction.CHAT_READ,
        target: { conversationId: "conv-1" },
      }),
    );

    expect(chat.markRead).toHaveBeenCalledWith("user-1", "conv-1");
  });

  it("plans a game in the backlog, and any other work as planned", async () => {
    const { service, games, library } = make();

    await service.perform(
      token({
        action: NotificationAction.PLAN_WORK,
        target: { domain: "game", sourceId: "1942" },
      }),
    );
    await service.perform(
      token({
        action: NotificationAction.PLAN_WORK,
        target: { source: "TMDB", sourceId: "95396", type: "SERIES" },
      }),
    );

    expect(games.upsertEntry).toHaveBeenCalledWith("user-1", {
      source: GameSource.IGDB,
      sourceId: "1942",
      status: GameStatus.BACKLOG,
    });
    expect(library.upsertEntry).toHaveBeenCalledWith("user-1", {
      source: "TMDB",
      sourceId: "95396",
      type: "SERIES",
      status: "PLANNED",
    });
  });

  it("only marks the notification read for MARK_READ and TEST", async () => {
    const { service, notifications } = make();

    await service.perform(token({ action: NotificationAction.MARK_READ }));
    await service.perform(token({ action: NotificationAction.TEST }));

    expect(notifications.markRead).toHaveBeenCalledTimes(2);
  });

  it("refuses TEST_FAILURE, as the sample of a failed action", async () => {
    const { service, notifications } = make();

    await rejectsWith(
      service.perform(token({ action: NotificationAction.TEST_FAILURE })),
      ErrorCode.NotificationActionInvalid,
    );
    expect(notifications.markRead).not.toHaveBeenCalled();
  });
});
