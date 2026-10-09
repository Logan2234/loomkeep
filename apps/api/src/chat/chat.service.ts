import {
  type AlertPrefs,
  type ChatMessageEvent,
  type ChatReadEvent,
  type CommentEmote,
  type CommentReactionSummaryDto,
  type ConversationDto,
  type ConversationReadOnlyReason,
  ErrorCode,
  FollowStatus,
  type MessageDto,
  type MessageWorkKind,
  type PagedResult,
  ProfileAccess,
  RealtimeEvent,
  type UserSummaryDto,
  isAlertEnabled,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { type ParsedPage, toPagedResult } from "../common/pagination.util";
import { EventsGateway } from "../events/events.gateway";
import { notificationCopy } from "../notifications/notification-copy";
import { PushService } from "../notifications/push.service";
import { PrismaService } from "../prisma/prisma.service";
import { BlockService } from "../social/block.service";
import { toUserSummaryDto } from "../users/avatar.util";
import { isSuspended } from "../users/suspension.util";
import type { WorkCard } from "./chat-work.service";

export const CONVERSATION_PAGE_SIZE = 50;
export const MESSAGE_PAGE_SIZE = 40;

const PEER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
  chatShowPresence: true,
  chatShowReadReceipts: true,
} as const;

type Peer = Prisma.UserGetPayload<{ select: typeof PEER_SELECT }>;

const MESSAGE_INCLUDE = {
  reactions: { select: { userId: true, emote: true } },
  embeds: {
    orderBy: { position: "asc" },
    select: { kind: true, title: true, imageUrl: true, href: true, year: true },
  },
} as const satisfies Prisma.MessageInclude;

type MessageRow = Prisma.MessageGetPayload<{
  include: typeof MESSAGE_INCLUDE;
}>;

type Viewer = {
  id: string;
  chatShowPresence: boolean;
  chatShowReadReceipts: boolean;
};

type Membership = {
  conversationId: string;
  lastReadAt: Date;
  mutedAt: Date | null;
  conversation: {
    id: string;
    lastMessageAt: Date;
    members: { userId: string; lastReadAt: Date; user: Peer }[];
  };
};

const MEMBERSHIP_SELECT = {
  conversationId: true,
  lastReadAt: true,
  mutedAt: true,
  conversation: {
    select: {
      id: true,
      lastMessageAt: true,
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: PEER_SELECT },
        },
      },
    },
  },
} as const;

/**
 * Private conversations between friends. Two accounts can write to each other
 * only while they follow each other (both follows accepted) and neither
 * blocked the other; a conversation that loses that stays readable but
 * read-only, except for whoever got blocked, who no longer sees it at all.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlockService,
    private readonly events: EventsGateway,
    private readonly push: PushService,
  ) {}

  /** The viewer's conversations that have at least one message, most recent first. */
  async list(
    viewerId: string,
    page: ParsedPage,
  ): Promise<PagedResult<ConversationDto>> {
    const viewer = await this.viewer(viewerId);
    const rows = (await this.prisma.conversationMember.findMany({
      where: { userId: viewerId, conversation: { messages: { some: {} } } },
      orderBy: { conversation: { lastMessageAt: "desc" } },
      skip: page.skip,
      take: page.take + 1,
      select: MEMBERSHIP_SELECT,
    })) as Membership[];

    const { items, hasMore } = toPagedResult(rows, page.limit);
    const visible = await this.withoutBlockedViewer(viewerId, items);
    return {
      items: await this.toConversationDtos(viewer, visible),
      hasMore,
    };
  }

  async get(
    viewerId: string,
    conversationId: string,
  ): Promise<ConversationDto> {
    const viewer = await this.viewer(viewerId);
    const membership = await this.membership(viewerId, conversationId);
    const [dto] = await this.toConversationDtos(viewer, [membership]);
    return dto;
  }

  /** Finds, or starts, the conversation with a friend. */
  async open(viewerId: string, username: string): Promise<ConversationDto> {
    const peer = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (
      !peer ||
      peer.id === viewerId ||
      !(await this.areFriends(viewerId, peer.id))
    ) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ChatNotFriends);
    }

    const pairKey = [viewerId, peer.id].sort().join(":");
    const conversation = await this.prisma.conversation.upsert({
      where: { pairKey },
      update: {},
      create: {
        pairKey,
        members: { create: [{ userId: viewerId }, { userId: peer.id }] },
      },
      select: { id: true },
    });

    return this.get(viewerId, conversation.id);
  }

  /** Friends the viewer can start a conversation with, for "Nouveau message". */
  async friends(viewerId: string, query?: string): Promise<UserSummaryDto[]> {
    const viewer = await this.prisma.user.findUniqueOrThrow({
      where: { id: viewerId },
      select: { profileAccess: true },
    });
    if (viewer.profileAccess === ProfileAccess.GHOST) return [];

    const search = query?.trim();
    const rows = await this.prisma.user.findMany({
      where: {
        ...this.friendOf(viewerId),
        ...(search
          ? {
              OR: [
                { username: { contains: search, mode: "insensitive" } },
                { displayName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { displayName: "asc" },
      take: CONVERSATION_PAGE_SIZE,
      select: PEER_SELECT,
    });

    const blocked = await this.blocks.blockedEitherWayIds(
      viewerId,
      rows.map((r) => r.id),
    );
    return rows.filter((r) => !blocked.has(r.id)).map(toUserSummaryDto);
  }

  /** Newest first; the client reverses each page for display. */
  async messages(
    viewerId: string,
    conversationId: string,
    page: ParsedPage,
  ): Promise<PagedResult<MessageDto>> {
    await this.membership(viewerId, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take + 1,
      include: MESSAGE_INCLUDE,
    });
    const { items, hasMore } = toPagedResult(rows, page.limit);
    return { items: items.map((row) => toMessageDto(row, viewerId)), hasMore };
  }

  /** `work`: the card attached by hand, which lets `text` be empty. */
  async send(
    authorId: string,
    conversationId: string,
    text: string | null,
    spoiler = false,
    work: WorkCard | null = null,
  ): Promise<MessageDto> {
    const membership = await this.membership(authorId, conversationId);
    const peer = peerOf(membership, authorId);
    await this.ensureWritable(authorId, peer);

    const now = new Date();
    const [row] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          authorId,
          text,
          spoiler,
          createdAt: now,
          embeds: work ? { create: { ...work, position: 0 } } : undefined,
        },
        include: MESSAGE_INCLUDE,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      }),
      // Writing in a conversation means having read it.
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: authorId } },
        data: { lastReadAt: now },
      }),
    ]);

    this.publish(membership, row);
    if (peer) await this.pushIfAway(authorId, peer.userId, conversationId);
    return toMessageDto(row, authorId);
  }

  async edit(
    authorId: string,
    messageId: string,
    text: string,
    spoiler = false,
  ): Promise<MessageDto> {
    const { message, membership } = await this.ownMessage(authorId, messageId);
    await this.ensureWritable(authorId, peerOf(membership, authorId));

    const row = await this.prisma.message.update({
      where: { id: message.id },
      data: { text, spoiler, edited: true },
      include: MESSAGE_INCLUDE,
    });
    this.publish(membership, row);
    return toMessageDto(row, authorId);
  }

  /**
   * "Recommander": the work goes to each friend as a message of its own, in
   * their conversation together. Every recipient is checked before anything
   * is sent, so a refusal sends nothing.
   */
  async recommend(
    authorId: string,
    usernames: string[],
    text: string | null,
    work: WorkCard,
  ): Promise<number> {
    const conversations: ConversationDto[] = [];

    for (const username of usernames) {
      conversations.push(await this.open(authorId, username));
    }

    for (const conversation of conversations) {
      await this.send(authorId, conversation.id, text, false, work);
    }

    return conversations.length;
  }

  /** The cards found in a message's links, replacing the previous ones. */
  async replaceLinkedWorks(
    messageId: string,
    cards: WorkCard[],
  ): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, deletedAt: true },
    });
    if (!message || message.deletedAt) return;

    const [removed] = await this.prisma.$transaction([
      this.prisma.messageEmbed.deleteMany({
        where: { messageId, position: { gt: 0 } },
      }),
      this.prisma.messageEmbed.createMany({
        data: cards.map((card, index) => ({
          ...card,
          messageId,
          position: index + 1,
        })),
      }),
    ]);

    if (removed.count > 0 || cards.length > 0) {
      await this.publishToMembers(message.conversationId, messageId);
    }
  }

  /** Leaves a tombstone, so whatever answers it keeps something to point at. */
  async remove(authorId: string, messageId: string): Promise<void> {
    const { message, membership } = await this.ownMessage(authorId, messageId);
    const row = await this.tombstone(message.id, false, this.prisma);
    this.publish(membership, row);
  }

  /** One reaction per member and message: a second emote replaces the first. */
  async react(
    userId: string,
    messageId: string,
    emote: CommentEmote,
  ): Promise<void> {
    const { message, membership } = await this.memberMessage(userId, messageId);
    await this.ensureWritable(userId, peerOf(membership, userId));

    await this.prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId: message.id, userId } },
      update: { emote },
      create: { messageId: message.id, userId, emote },
    });
    await this.publishById(membership, message.id);
  }

  async unreact(userId: string, messageId: string): Promise<void> {
    const { message, membership } = await this.memberMessage(userId, messageId);
    await this.prisma.messageReaction.deleteMany({
      where: { messageId: message.id, userId },
    });
    await this.publishById(membership, message.id);
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    const membership = await this.membership(userId, conversationId);
    const lastReadAt = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt },
    });

    const event: ChatReadEvent = {
      conversationId,
      userId,
      lastReadAt: lastReadAt.toISOString(),
    };
    // The reader's other devices drop their unread count too.
    this.events.emitToUser(userId, RealtimeEvent.CHAT_READ, event);

    const peer = peerOf(membership, userId);
    const reader = membership.conversation.members.find(
      (m) => m.userId === userId,
    );

    if (peer && reader && showsReadReceipts(reader.user, peer.user)) {
      this.events.emitToUser(peer.userId, RealtimeEvent.CHAT_READ, event);
    }
  }

  async mute(
    userId: string,
    conversationId: string,
    muted: boolean,
  ): Promise<void> {
    await this.membership(userId, conversationId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { mutedAt: muted ? new Date() : null },
    });
  }

  /** Unread messages across the conversations the user didn't mute. */
  async unreadTotal(userId: string): Promise<number> {
    const counts = await this.unreadCounts(userId, true);
    return [...counts.values()].reduce((sum, n) => sum + n, 0);
  }

  /**
   * Checks the reporter can see the message before ReportService files it:
   * a message is only reportable by the other member of its conversation.
   */
  async ensureReportable(reporterId: string, messageId: string): Promise<void> {
    await this.memberMessage(reporterId, messageId);
  }

  /**
   * Moderation takedown. Returns what the decision needs to quote, read
   * before the text is erased.
   */
  async adminRemove(
    messageId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{
    authorId: string | null;
    text: string | null;
    conversationId: string;
  }> {
    const message = await tx.message.findUnique({ where: { id: messageId } });

    if (!message || message.deletedAt) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ChatMessageNotFound,
      );
    }

    await this.tombstone(messageId, true, tx);
    return {
      authorId: message.authorId,
      text: message.text,
      conversationId: message.conversationId,
    };
  }

  /** After the takedown's transaction committed: both members see the tombstone. */
  async publishAdminRemoval(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.publishToMembers(conversationId, messageId);
  }

  private async publishToMembers(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const row = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: MESSAGE_INCLUDE,
    });
    if (!row) return;

    for (const { userId } of members) {
      this.emitMessage(userId, row);
    }
  }

  /**
   * Account deletion, before the user row goes: their messages' text is
   * erased (it's theirs, and it can identify them even once unlinked), and
   * the conversations left with no member at all disappear afterwards.
   */
  async eraseAuthor(userId: string): Promise<void> {
    await this.prisma.messageEmbed.deleteMany({
      where: { message: { authorId: userId } },
    });
    await this.prisma.message.updateMany({
      where: { authorId: userId, deletedAt: null },
      data: { text: null, deletedAt: new Date() },
    });
  }

  async purgeEmptyConversations(): Promise<void> {
    await this.prisma.conversation.deleteMany({
      where: { members: { none: {} } },
    });
  }

  private async viewer(userId: string): Promise<Viewer> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, chatShowPresence: true, chatShowReadReceipts: true },
    });
  }

  /** The viewer's membership, 404 when they aren't in it or were blocked by the other member. */
  private async membership(
    userId: string,
    conversationId: string,
  ): Promise<Membership> {
    const membership = (await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: MEMBERSHIP_SELECT,
    })) as Membership | null;

    const peer = membership ? peerOf(membership, userId) : null;

    if (
      !membership ||
      (peer && (await this.blocks.isBlocked(peer.userId, userId)))
    ) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ChatConversationNotFound,
      );
    }

    return membership;
  }

  private async memberMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        authorId: true,
        conversationId: true,
        deletedAt: true,
      },
    });

    if (!message || message.deletedAt) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ChatMessageNotFound,
      );
    }

    const membership = await this.membership(userId, message.conversationId);
    return { message, membership };
  }

  private async ownMessage(userId: string, messageId: string) {
    const found = await this.memberMessage(userId, messageId);

    if (found.message.authorId !== userId) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ChatForbidden);
    }

    return found;
  }

  private async ensureWritable(
    userId: string,
    peer: Membership["conversation"]["members"][number] | null,
  ): Promise<void> {
    if (!peer || (await this.readOnlyReason(userId, peer.userId)) !== null) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ChatReadOnly);
    }
  }

  private async readOnlyReason(
    viewerId: string,
    peerId: string | null,
  ): Promise<ConversationReadOnlyReason | null> {
    if (!peerId) return "deleted";
    if (await this.blocks.isBlocked(viewerId, peerId)) return "blocked";
    return (await this.areFriends(viewerId, peerId)) ? null : "unfollowed";
  }

  /**
   * Both follows accepted, and neither is a Figurant. Stricter than the
   * profile's notion of a friend, which lets a PRIVATE account count as one
   * from a single accepted follow: being written to asks more than being seen.
   */
  private async areFriends(a: string, b: string): Promise<boolean> {
    const notGhost = { profileAccess: { not: ProfileAccess.GHOST } };
    const follows = await this.prisma.follow.count({
      where: {
        status: FollowStatus.ACCEPTED,
        OR: [
          { followerId: a, followeeId: b },
          { followerId: b, followeeId: a },
        ],
        follower: notGhost,
        followee: notGhost,
      },
    });
    return follows === 2 && !(await this.blocks.isBlockedEitherWay(a, b));
  }

  /** Accounts `userId` follows and is followed back by, Figurants excluded. */
  private friendOf(userId: string): Prisma.UserWhereInput {
    return {
      profileAccess: { not: ProfileAccess.GHOST },
      followers: {
        some: { followerId: userId, status: FollowStatus.ACCEPTED },
      },
      following: {
        some: { followeeId: userId, status: FollowStatus.ACCEPTED },
      },
    };
  }

  private async withoutBlockedViewer(
    viewerId: string,
    memberships: Membership[],
  ): Promise<Membership[]> {
    const peerIds = memberships.flatMap((m) => {
      const peer = peerOf(m, viewerId);
      return peer ? [peer.userId] : [];
    });
    const blockedBy = await this.prisma.block.findMany({
      where: { blockerId: { in: peerIds }, blockedId: viewerId },
      select: { blockerId: true },
    });
    const hidden = new Set(blockedBy.map((b) => b.blockerId));
    return memberships.filter((m) => {
      const peer = peerOf(m, viewerId);
      return !peer || !hidden.has(peer.userId);
    });
  }

  private async toConversationDtos(
    viewer: Viewer,
    memberships: Membership[],
  ): Promise<ConversationDto[]> {
    if (memberships.length === 0) return [];
    const ids = memberships.map((m) => m.conversationId);
    // DISTINCT ON in SQL: Prisma's `distinct` would read every message of
    // every conversation and deduplicate in memory.
    const lastIds = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT ON ("conversationId") id
      FROM "Message"
      WHERE "conversationId" IN (${Prisma.join(ids)})
      ORDER BY "conversationId", "createdAt" DESC, id DESC
    `;
    const [unread, lastMessages] = await Promise.all([
      this.unreadCounts(viewer.id, false),
      this.prisma.message.findMany({
        where: { id: { in: lastIds.map((r) => r.id) } },
        include: MESSAGE_INCLUDE,
      }),
    ]);
    const lastByConversation = new Map(
      lastMessages.map((m) => [m.conversationId, m]),
    );

    return Promise.all(
      memberships.map(async (m): Promise<ConversationDto> => {
        const peer = peerOf(m, viewer.id);
        const last = lastByConversation.get(m.conversationId);
        const presenceShared =
          !!peer && viewer.chatShowPresence && peer.user.chatShowPresence;
        return {
          id: m.conversationId,
          peer: peer ? toUserSummaryDto(peer.user) : null,
          readOnly: await this.readOnlyReason(viewer.id, peer?.userId ?? null),
          peerOnline: presenceShared
            ? await this.events.isOnline(peer.userId)
            : null,
          peerLastReadAt:
            peer && showsReadReceipts(viewer, peer.user)
              ? peer.lastReadAt.toISOString()
              : null,
          lastMessage: last ? toMessageDto(last, viewer.id) : null,
          unread: unread.get(m.conversationId) ?? 0,
          muted: m.mutedAt !== null,
          lastMessageAt: m.conversation.lastMessageAt.toISOString(),
        };
      }),
    );
  }

  /** Per conversation: the other member's messages sent after the user last read. */
  private async unreadCounts(
    userId: string,
    skipMuted: boolean,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<
      { conversationId: string; count: bigint }[]
    >`
      SELECT m."conversationId", COUNT(*) AS count
      FROM "Message" m
      JOIN "ConversationMember" cm
        ON cm."conversationId" = m."conversationId" AND cm."userId" = ${userId}
      WHERE m."authorId" IS DISTINCT FROM ${userId}
        AND m."deletedAt" IS NULL
        AND m."createdAt" > cm."lastReadAt"
        AND (${!skipMuted} OR cm."mutedAt" IS NULL)
      GROUP BY m."conversationId"
    `;
    return new Map(rows.map((r) => [r.conversationId, Number(r.count)]));
  }

  private async tombstone(
    messageId: string,
    byAdmin: boolean,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<MessageRow> {
    await db.messageReaction.deleteMany({ where: { messageId } });
    await db.messageEmbed.deleteMany({ where: { messageId } });
    return db.message.update({
      where: { id: messageId },
      data: { text: null, deletedAt: new Date(), deletedByAdmin: byAdmin },
      include: MESSAGE_INCLUDE,
    });
  }

  private async publishById(
    membership: Membership,
    messageId: string,
  ): Promise<void> {
    const row = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: MESSAGE_INCLUDE,
    });
    this.publish(membership, row);
  }

  /** Each member gets the message as they see it (`mine`, `myReaction`). */
  private publish(membership: Membership, row: MessageRow): void {
    for (const member of membership.conversation.members) {
      this.emitMessage(member.userId, row);
    }
  }

  private emitMessage(userId: string, row: MessageRow): void {
    const event: ChatMessageEvent = {
      conversationId: row.conversationId,
      message: toMessageDto(row, userId),
    };
    this.events.emitToUser(userId, RealtimeEvent.CHAT_MESSAGE, event);
  }

  /** A push only reaches someone who has the app open nowhere: otherwise the launcher's count says it. */
  private async pushIfAway(
    authorId: string,
    recipientId: string,
    conversationId: string,
  ): Promise<void> {
    if (await this.events.isOnline(recipientId)) return;

    const [recipient, author, member] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: recipientId },
        select: { locale: true, alertPrefs: true, suspendedUntil: true },
      }),
      this.prisma.user.findUnique({
        where: { id: authorId },
        select: { displayName: true },
      }),
      this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: { conversationId, userId: recipientId },
        },
        select: { mutedAt: true },
      }),
    ]);

    if (
      !recipient ||
      !author ||
      member?.mutedAt ||
      isSuspended(recipient) ||
      !isAlertEnabled(
        recipient.alertPrefs as AlertPrefs,
        "CHAT_MESSAGE",
        "push",
      )
    ) {
      return;
    }

    try {
      await this.push.sendToUser(recipientId, {
        title: author.displayName,
        body: notificationCopy(recipient.locale).chatMessage,
        url: `/app?messages=${conversationId}`,
        tag: `chat:${conversationId}`,
      });
    } catch (err) {
      // The message is saved: a push service failing mustn't fail sending it.
      this.logger.error(`Push failed for ${recipientId}`, err);
    }
  }
}

function peerOf(
  membership: Membership,
  viewerId: string,
): Membership["conversation"]["members"][number] | null {
  return (
    membership.conversation.members.find((m) => m.userId !== viewerId) ?? null
  );
}

function showsReadReceipts(
  a: { chatShowReadReceipts: boolean },
  b: { chatShowReadReceipts: boolean },
): boolean {
  return a.chatShowReadReceipts && b.chatShowReadReceipts;
}

function toMessageDto(row: MessageRow, viewerId: string): MessageDto {
  const counts = new Map<CommentEmote, number>();
  let myReaction: CommentEmote | null = null;

  for (const reaction of row.reactions) {
    counts.set(reaction.emote, (counts.get(reaction.emote) ?? 0) + 1);
    if (reaction.userId === viewerId) myReaction = reaction.emote;
  }

  const reactions: CommentReactionSummaryDto[] = [...counts].map(
    ([emote, count]) => ({ emote, count }),
  );

  return {
    id: row.id,
    conversationId: row.conversationId,
    authorId: row.authorId,
    mine: row.authorId === viewerId,
    text: row.deletedAt ? null : row.text,
    spoiler: row.spoiler,
    edited: row.edited,
    deleted: row.deletedAt !== null,
    deletedByAdmin: row.deletedByAdmin,
    reactions,
    myReaction,
    works: row.deletedAt
      ? []
      : row.embeds.map((embed) => ({
          ...embed,
          kind: embed.kind as MessageWorkKind,
        })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
