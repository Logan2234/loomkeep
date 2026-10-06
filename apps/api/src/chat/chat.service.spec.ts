import { ErrorCode, RealtimeEvent } from "@loomkeep/shared";
import { type Mock, vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { EventsGateway } from "../events/events.gateway";
import { notificationCopy } from "../notifications/notification-copy";
import type { PushService } from "../notifications/push.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { BlockService } from "../social/block.service";
import { ChatService } from "./chat.service";

const ME = "me";
const LEA = "lea";

function peer(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    username: id,
    displayName: id === LEA ? "Léa" : "Moi",
    profileAccess: "PUBLIC",
    avatarUpdatedAt: null,
    chatShowPresence: true,
    chatShowReadReceipts: true,
    ...over,
  };
}

function membership(
  over: { lea?: Record<string, unknown>; me?: Record<string, unknown> } = {},
) {
  return {
    conversationId: "cv1",
    lastReadAt: new Date("2026-10-06T20:00:00Z"),
    mutedAt: null,
    conversation: {
      id: "cv1",
      lastMessageAt: new Date("2026-10-06T21:00:00Z"),
      members: [
        {
          userId: ME,
          lastReadAt: new Date("2026-10-06T20:00:00Z"),
          user: peer(ME, over.me),
        },
        {
          userId: LEA,
          lastReadAt: new Date("2026-10-06T21:43:00Z"),
          user: peer(LEA, over.lea),
        },
      ],
    },
  };
}

function messageRow(over: Record<string, unknown> = {}) {
  return {
    id: "m1",
    conversationId: "cv1",
    authorId: ME,
    text: "Je suis **K.O.**",
    spoiler: false,
    edited: false,
    deletedAt: null,
    deletedByAdmin: false,
    createdAt: new Date("2026-10-06T21:34:00Z"),
    updatedAt: new Date("2026-10-06T21:34:00Z"),
    reactions: [],
    ...over,
  };
}

function setup(
  opts: { friends?: boolean; blockedByPeer?: boolean; online?: boolean } = {},
) {
  const { friends = true, blockedByPeer = false, online = false } = opts;
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: Record<string, string> }) => {
          if (where.username === LEA) return { id: LEA };

          if (where.id === LEA) {
            return {
              locale: "fr",
              alertPrefs: {},
              suspendedUntil: null,
              displayName: "Léa",
            };
          }

          return {
            displayName: "Moi",
            locale: "fr",
            alertPrefs: {},
            suspendedUntil: null,
          };
        }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: ME,
        chatShowPresence: true,
        chatShowReadReceipts: true,
        profileAccess: "PUBLIC",
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    follow: { count: vi.fn().mockResolvedValue(friends ? 2 : 1) },
    conversation: {
      upsert: vi.fn().mockResolvedValue({ id: "cv1" }),
      update: vi.fn(),
    },
    conversationMember: {
      findUnique: vi
        .fn()
        .mockImplementation(
          ({ select }: { select: Record<string, unknown> }) =>
            select.mutedAt && !select.conversation
              ? { mutedAt: null }
              : membership(),
        ),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn().mockResolvedValue(messageRow()),
      findUnique: vi.fn().mockResolvedValue({
        id: "m1",
        authorId: LEA,
        conversationId: "cv1",
        deletedAt: null,
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(messageRow()),
    },
    messageReaction: { deleteMany: vi.fn() },
    messageEmbed: { deleteMany: vi.fn() },
    block: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const blocks = {
    isBlocked: vi
      .fn()
      .mockImplementation(
        (blocker: string) => blockedByPeer && blocker === LEA,
      ),
    isBlockedEitherWay: vi.fn().mockResolvedValue(false),
    blockedEitherWayIds: vi.fn().mockResolvedValue(new Set()),
  } as unknown as BlockService;
  const events = {
    emitToUser: vi.fn(),
    isOnline: vi.fn().mockResolvedValue(online),
  } as unknown as EventsGateway;
  const push = { sendToUser: vi.fn() } as unknown as PushService;

  return {
    service: new ChatService(prisma, blocks, events, push),
    prisma,
    events,
    push,
  };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => {
    expect(error.code).toBe(code);
  });
}

describe("ChatService", () => {
  describe("open", () => {
    it("starts one conversation per pair of friends, keyed by both sorted ids", async () => {
      const { service, prisma } = setup();

      await service.open(ME, LEA);

      expect(prisma.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pairKey: "lea:me" } }),
      );
    });

    // A PRIVATE account that accepted a follow counts as a friend on its
    // profile, but writing to someone asks for both follows.
    it("refuses an account that doesn't follow back", async () => {
      const { service, prisma } = setup({ friends: false });

      await expectCode(service.open(ME, LEA), ErrorCode.ChatNotFriends);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });
  });

  describe("send", () => {
    it("hands each member their own copy of the new message", async () => {
      const { service, events } = setup({ online: true });

      await service.send(ME, "cv1", "Je suis **K.O.**");

      const emit = events.emitToUser as Mock;
      const toMe = emit.mock.calls.find(([user]) => user === ME);
      const toLea = emit.mock.calls.find(([user]) => user === LEA);
      expect(toMe?.[1]).toBe(RealtimeEvent.CHAT_MESSAGE);
      expect(toMe?.[2].message.mine).toBe(true);
      expect(toLea?.[2].message.mine).toBe(false);
    });

    it("marks the conversation read for its author", async () => {
      const { service, prisma } = setup();

      await service.send(ME, "cv1", "Salut");

      expect(prisma.conversationMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId_userId: { conversationId: "cv1", userId: ME },
          },
        }),
      );
    });

    it("refuses once the two no longer follow each other", async () => {
      const { service, prisma } = setup({ friends: false });

      await expectCode(
        service.send(ME, "cv1", "Salut"),
        ErrorCode.ChatReadOnly,
      );
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it("pushes, without the text, only to a recipient who has the app open nowhere", async () => {
      const away = setup({ online: false });
      await away.service.send(ME, "cv1", "Un secret");

      expect(away.push.sendToUser).toHaveBeenCalledWith(LEA, {
        title: "Moi",
        body: notificationCopy("fr").chatMessage,
        url: "/app?messages=cv1",
        tag: "chat:cv1",
      });

      const here = setup({ online: true });
      await here.service.send(ME, "cv1", "Salut");
      expect(here.push.sendToUser).not.toHaveBeenCalled();
    });
  });

  it("hides a conversation from whoever the other member blocked", async () => {
    const { service } = setup({ blockedByPeer: true });

    await expectCode(
      service.get(ME, "cv1"),
      ErrorCode.ChatConversationNotFound,
    );
  });

  it("only lets the author edit or delete a message", async () => {
    const { service } = setup();

    await expectCode(
      service.edit(ME, "m1", "Modifié"),
      ErrorCode.ChatForbidden,
    );
    await expectCode(service.remove(ME, "m1"), ErrorCode.ChatForbidden);
  });

  describe("read receipts and presence are reciprocal", () => {
    it("tells the other member about a read only when both show read receipts", async () => {
      const shared = setup();
      await shared.service.markRead(ME, "cv1");
      expect(
        (shared.events.emitToUser as Mock).mock.calls.map(([user]) => user),
      ).toEqual([ME, LEA]);

      const hidden = setup();
      (hidden.prisma.conversationMember.findUnique as Mock).mockResolvedValue(
        membership({ me: { chatShowReadReceipts: false } }),
      );
      await hidden.service.markRead(ME, "cv1");
      expect(
        (hidden.events.emitToUser as Mock).mock.calls.map(([user]) => user),
      ).toEqual([ME]);
    });

    it("leaves the peer's presence and last read unknown when the viewer hides theirs", async () => {
      const { service, prisma } = setup({ online: true });
      (prisma.user.findUniqueOrThrow as Mock).mockResolvedValue({
        id: ME,
        chatShowPresence: false,
        chatShowReadReceipts: false,
      });

      const conversation = await service.get(ME, "cv1");

      expect(conversation.peerOnline).toBeNull();
      expect(conversation.peerLastReadAt).toBeNull();
    });

    it("shows them when both share them", async () => {
      const { service } = setup({ online: true });

      const conversation = await service.get(ME, "cv1");

      expect(conversation.peerOnline).toBe(true);
      expect(conversation.peerLastReadAt).toBe("2026-10-06T21:43:00.000Z");
    });
  });
});
