import { ErrorCode, RealtimeEvent } from "@loomkeep/shared";
import { type Mock, vi } from "vitest";
import { AppException } from "../common/app.exception";
import { parsePageQuery } from "../common/pagination.util";
import type { EventsGateway } from "../events/events.gateway";
import { notificationCopy } from "../notifications/notification-copy";
import type { PushService } from "../notifications/push.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { BlockService } from "../social/block.service";
import type { WorkCard } from "./chat-work.service";
import { ChatService } from "./chat.service";

const ME = "me";
const LEA = "lea";
// Follows ME, but ME doesn't follow back.
const ZOE = "zoe";

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
    embeds: [],
    pinnedAt: null,
    forwarded: false,
    ...over,
  };
}

// The card as a viewer gets it: no target, and whether they track the work.
const SEVERANCE_SEEN = {
  kind: "SERIES",
  title: "Severance",
  imageUrl: "https://image.tmdb.org/t/p/w342/severance.jpg",
  href: "/app/media/series/95396",
  year: 2022,
} as const;

const SEVERANCE: WorkCard = {
  targetType: "MEDIA",
  targetId: "media-1",
  ...SEVERANCE_SEEN,
};

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
          if (where.username === ZOE) return { id: ZOE };

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
    follow: {
      count: vi
        .fn()
        .mockImplementation(
          ({ where }: { where: { OR: { followeeId: string }[] } }) =>
            friends && where.OR[0].followeeId !== ZOE ? 2 : 1,
        ),
    },
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
        pinnedAt: null,
        createdAt: new Date("2026-10-06T21:34:00Z"),
      }),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(messageRow()),
    },
    messageReaction: { deleteMany: vi.fn() },
    messageEmbed: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn(),
    },
    block: { findMany: vi.fn().mockResolvedValue([]) },
    libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
    gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
    bookEntry: { findMany: vi.fn().mockResolvedValue([]) },
    musicEntry: { findMany: vi.fn().mockResolvedValue([]) },
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

// The message forwarded comes from cv0; every conversation opened is cv1.
function fromAnotherConversation(prisma: PrismaService) {
  (prisma.message.findUnique as Mock).mockResolvedValue({
    id: "m1",
    authorId: LEA,
    conversationId: "cv0",
    deletedAt: null,
    pinnedAt: null,
    createdAt: new Date("2026-10-06T21:34:00Z"),
  });
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

  describe("work cards", () => {
    it("stores the attached work as the message's first card", async () => {
      const { service, prisma } = setup();
      (prisma.message.create as Mock).mockResolvedValue(
        messageRow({ text: null, embeds: [SEVERANCE] }),
      );

      const message = await service.send(ME, "cv1", null, false, SEVERANCE);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text: null,
            embeds: { create: [{ ...SEVERANCE, position: 0 }] },
          }),
        }),
      );
      expect(message.works).toEqual([{ ...SEVERANCE_SEEN, inLibrary: false }]);
    });

    it("recommends to each friend in their own conversation", async () => {
      const { service, prisma } = setup();

      const sent = await service.recommend(ME, [LEA], "À voir", SEVERANCE);

      expect(sent).toBe(1);
      expect(prisma.message.create).toHaveBeenCalledTimes(1);
    });

    // Checked before sending: one refusal mustn't leave the others half-sent.
    it("sends nothing when one recipient isn't a friend", async () => {
      const { service, prisma } = setup();

      await expectCode(
        service.recommend(ME, [LEA, ZOE], null, SEVERANCE),
        ErrorCode.ChatNotFriends,
      );
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it("replaces the link cards, keeping the attached one", async () => {
      const { service, prisma, events } = setup();
      (prisma.conversationMember.findMany as Mock).mockResolvedValue([
        { userId: ME },
        { userId: LEA },
      ]);
      (prisma.message.findUnique as Mock).mockResolvedValue(messageRow());

      await service.replaceLinkedWorks("m1", [SEVERANCE]);

      expect(prisma.messageEmbed.deleteMany).toHaveBeenCalledWith({
        where: { messageId: "m1", position: { gt: 0 } },
      });
      expect(prisma.messageEmbed.createMany).toHaveBeenCalledWith({
        data: [{ ...SEVERANCE, messageId: "m1", position: 1 }],
      });
      expect(events.emitToUser).toHaveBeenCalledTimes(2);
    });

    it("keeps a deleted message's cards out of sight", async () => {
      const { service, prisma } = setup();
      (prisma.message.findMany as Mock).mockResolvedValue([
        messageRow({ deletedAt: new Date(), embeds: [SEVERANCE] }),
      ]);

      const page = await service.messages(
        ME,
        "cv1",
        parsePageQuery(undefined, undefined, 40),
      );

      expect(page.items[0].works).toEqual([]);
    });
  });

  describe("message tools", () => {
    it("tells the viewer which cards are of works they already track", async () => {
      const { service, prisma } = setup();
      (prisma.message.findMany as Mock).mockResolvedValue([
        messageRow({ embeds: [SEVERANCE] }),
      ]);
      (prisma.libraryEntry.findMany as Mock).mockResolvedValue([
        { mediaItemId: "media-1" },
      ]);

      const page = await service.messages(
        ME,
        "cv1",
        parsePageQuery(undefined, undefined, 40),
      );

      expect(page.items[0].works[0].inLibrary).toBe(true);
    });

    it("keeps a conversation's pins under the limit", async () => {
      const { service, prisma } = setup();
      (prisma.message.count as Mock).mockResolvedValue(50);

      await expectCode(service.pin(ME, "m1", true), ErrorCode.ChatPinLimit);
      expect(prisma.message.update).not.toHaveBeenCalled();
    });

    it("pins for both members", async () => {
      const { service, prisma, events } = setup();
      (prisma.message.findUniqueOrThrow as Mock).mockResolvedValue(
        messageRow({ pinnedAt: new Date() }),
      );

      await service.pin(ME, "m1", true);

      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { pinnedAt: expect.any(Date) },
      });
      const emitted = (events.emitToUser as Mock).mock.calls.map(
        ([, , event]) => event.message.pinned,
      );
      expect(emitted).toEqual([true, true]);
    });

    it("marks a conversation unread from a message on", async () => {
      const { service, prisma } = setup();

      await service.markUnreadFrom(ME, "m1");

      expect(prisma.conversationMember.update).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId: "cv1", userId: ME } },
        data: { lastReadAt: new Date("2026-10-06T21:33:59.999Z") },
      });
    });

    it("forwards a copy, marked forwarded, with its cards", async () => {
      const { service, prisma } = setup();
      fromAnotherConversation(prisma);
      (prisma.message.findUniqueOrThrow as Mock).mockResolvedValue(
        messageRow({
          text: "La fin !",
          embeds: [{ ...SEVERANCE, id: "e1", messageId: "m1", position: 0 }],
        }),
      );

      const sent = await service.forward(ME, "m1", [LEA]);

      expect(sent).toBe(1);
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text: "La fin !",
            forwarded: true,
            embeds: { create: [{ ...SEVERANCE, position: 0 }] },
          }),
        }),
      );
    });

    it("doesn't forward a message back into its own conversation", async () => {
      const { service, prisma } = setup();
      (prisma.message.findUniqueOrThrow as Mock).mockResolvedValue(
        messageRow(),
      );

      await expectCode(
        service.forward(ME, "m1", [LEA]),
        ErrorCode.ChatForwardToOrigin,
      );
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it("searches the text, case aside, from two characters on", async () => {
      const { service, prisma } = setup();

      expect(await service.search(ME, "cv1", " a ")).toEqual([]);
      expect(prisma.message.findMany).not.toHaveBeenCalled();

      await service.search(ME, "cv1", "Helly");
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId: "cv1",
            deletedAt: null,
            text: { contains: "Helly", mode: "insensitive" },
          },
        }),
      );
    });

    it("lists each shared work once, from its latest card", async () => {
      const { service, prisma } = setup();
      const card = (messageId: string, authorId: string, at: string) => ({
        ...SEVERANCE,
        id: `e-${messageId}`,
        messageId,
        position: 0,
        message: { authorId, createdAt: new Date(at) },
      });
      (prisma.messageEmbed as unknown as { findMany: Mock }).findMany = vi
        .fn()
        .mockResolvedValue([
          card("m2", LEA, "2026-10-08T10:00:00Z"),
          card("m1", ME, "2026-10-07T10:00:00Z"),
        ]);

      const works = await service.works(ME, "cv1");

      expect(works).toEqual([
        {
          ...SEVERANCE_SEEN,
          inLibrary: false,
          messageId: "m2",
          sharedAt: "2026-10-08T10:00:00.000Z",
          mine: false,
        },
      ]);
    });

    it("forwards nothing when one recipient isn't a friend", async () => {
      const { service, prisma } = setup();
      fromAnotherConversation(prisma);
      (prisma.message.findUniqueOrThrow as Mock).mockResolvedValue(
        messageRow(),
      );

      await expectCode(
        service.forward(ME, "m1", [LEA, ZOE]),
        ErrorCode.ChatNotFriends,
      );
      expect(prisma.message.create).not.toHaveBeenCalled();
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
