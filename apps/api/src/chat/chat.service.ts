import {
  AlertGroup,
  CHAT_SEARCH_MIN_LENGTH,
  type ChatMessageEvent,
  type ChatReadEvent,
  type CommentEmote,
  type CommentReactionSummaryDto,
  type ConversationDto,
  type ConversationReadOnlyReason,
  type ConversationWorkDto,
  type Domain,
  ErrorCode,
  FollowStatus,
  isAlertEnabled,
  type MessageDto,
  type MessageListDto,
  type MessagePickDto,
  type MessagePollDto,
  type MessageReviewDto,
  type MessageSagaRefDto,
  type MessageWorkKind,
  type PagedResult,
  PINNED_MESSAGES_MAX,
  ProfileAccess,
  RealtimeEvent,
  type UserSummaryDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { type ParsedPage, toPagedResult } from "../common/pagination.util";
import { EventsGateway } from "../events/events.gateway";
import { ListService } from "../lists/list.service";
import { readAlertPrefs } from "../notifications/alert-prefs.util";
import { NotificationAction } from "../notifications/notification-action";
import { notificationCopy } from "../notifications/notification-copy";
import { PushService } from "../notifications/push.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
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
    select: {
      targetType: true,
      targetId: true,
      kind: true,
      title: true,
      imageUrl: true,
      href: true,
      year: true,
    },
  },
  poll: {
    select: {
      question: true,
      options: {
        orderBy: { position: "asc" },
        select: { id: true, text: true, href: true, imageUrl: true },
      },
      votes: {
        orderBy: { createdAt: "asc" },
        select: {
          optionId: true,
          userId: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileAccess: true,
              avatarUpdatedAt: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.MessageInclude;

type MessageRow = Prisma.MessageGetPayload<{
  include: typeof MESSAGE_INCLUDE;
}>;

/** What drawing messages for one viewer needs beyond their rows. */
type MessageCards = {
  /** The works among their cards the viewer already tracks. */
  owned: ReadonlySet<string>;
  reviews: ReadonlyMap<string, MessageReviewDto>;
  /** Only the lists the viewer may see. */
  lists: ReadonlyMap<string, MessageListDto>;
};

/** What a message carries besides its text. */
export type MessageAttachment = {
  /** The card attached by hand (or drawn by /pick), which lets `text` be empty. */
  work?: WorkCard | null;
  reviewId?: string;
  listId?: string;
  /** /poll, its works already turned into cards. */
  poll?: PollDraft;
  /** /saga, checked to be a saga the author can see. */
  saga?: { domain: Domain; key: string };
  /** /pick: what `work` was drawn from. */
  pick?: { domain: Domain; shared: boolean; count: number };
  /** /where: where `work` can be watched. */
  where?: boolean;
};

export type PollDraft = {
  question: string;
  options: { text: string; work: WorkCard | null }[];
};

/** What the /saga and /where cards read of their message. */
export type CommandMessage = {
  id: string;
  sagaDomain: Domain | null;
  sagaKey: string | null;
  whereWork: boolean;
  /** The first card: the work /where is about. */
  work: { targetType: string; targetId: string; href: string } | null;
  /** The conversation's members, the viewer among them. */
  memberIds: string[];
};

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
    private readonly reviews: ReviewService,
    private readonly lists: ListService,
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
    const cards = await this.cardsFor(viewerId, items);
    return {
      items: items.map((row) => toMessageDto(row, viewerId, cards)),
      hasMore,
    };
  }

  /** An attachment lets `text` be empty. */
  async send(
    authorId: string,
    conversationId: string,
    text: string | null,
    spoiler = false,
    {
      work = null,
      reviewId,
      listId,
      poll,
      saga,
      pick,
      where = false,
    }: MessageAttachment = {},
  ): Promise<MessageDto> {
    const membership = await this.membership(authorId, conversationId);
    if (reviewId) await this.ensureOwnReview(authorId, reviewId);

    if (listId) {
      const peer = peerOf(membership, authorId);
      await this.ensureSharedList(listId, [authorId, peer?.userId]);
    }

    const row = await this.deliver(authorId, membership, {
      text,
      spoiler,
      embeds: work ? [{ ...work, position: 0 }] : [],
      reviewId,
      listId,
      poll,
      sagaDomain: saga?.domain,
      sagaKey: saga?.key,
      pickDomain: pick?.domain,
      pickShared: pick?.shared,
      pickCount: pick?.count,
      whereWork: where,
    });
    return this.dtoFor(row, authorId);
  }

  private async deliver(
    authorId: string,
    membership: Membership,
    message: {
      text: string | null;
      spoiler: boolean;
      forwarded?: boolean;
      embeds: (WorkCard & { position: number })[];
      reviewId?: string | null;
      listId?: string | null;
      poll?: PollDraft;
      sagaDomain?: Domain | null;
      sagaKey?: string | null;
      pickDomain?: Domain | null;
      pickShared?: boolean | null;
      pickCount?: number | null;
      whereWork?: boolean;
    },
  ): Promise<MessageRow> {
    const { conversationId } = membership;
    const peer = peerOf(membership, authorId);
    await this.ensureWritable(authorId, peer);

    const now = new Date();
    const [row] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          authorId,
          text: message.text,
          spoiler: message.spoiler,
          forwarded: message.forwarded ?? false,
          reviewId: message.reviewId,
          listId: message.listId,
          sagaDomain: message.sagaDomain,
          sagaKey: message.sagaKey,
          pickDomain: message.pickDomain,
          pickShared: message.pickShared,
          pickCount: message.pickCount,
          whereWork: message.whereWork ?? false,
          poll: message.poll
            ? {
                create: {
                  question: message.poll.question,
                  options: {
                    create: message.poll.options.map((option, position) => ({
                      position,
                      text: option.work?.title ?? option.text,
                      href: option.work?.href,
                      imageUrl: option.work?.imageUrl,
                    })),
                  },
                },
              }
            : undefined,
          createdAt: now,
          embeds:
            message.embeds.length > 0 ? { create: message.embeds } : undefined,
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

    await this.publish(membership, row);
    if (peer) await this.pushIfAway(authorId, peer.userId, conversationId);
    return row;
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
      // Saved unchanged, it isn't "modifié".
      data: {
        text,
        spoiler,
        edited:
          message.edited ||
          message.text !== text ||
          message.spoiler !== spoiler,
      },
      include: MESSAGE_INCLUDE,
    });
    await this.publish(membership, row);
    return this.dtoFor(row, authorId);
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
      await this.send(authorId, conversation.id, text, false, { work });
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
    await this.publish(membership, row);
  }

  /** Either member pins or unpins; both see it. */
  async pin(userId: string, messageId: string, pinned: boolean): Promise<void> {
    const { message, membership } = await this.memberMessage(userId, messageId);
    await this.ensureWritable(userId, peerOf(membership, userId));

    if (pinned && !message.pinnedAt) {
      const count = await this.prisma.message.count({
        where: {
          conversationId: message.conversationId,
          pinnedAt: { not: null },
          deletedAt: null,
        },
      });

      if (count >= PINNED_MESSAGES_MAX) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.ChatPinLimit);
      }
    }

    await this.prisma.message.update({
      where: { id: message.id },
      data: { pinnedAt: pinned ? (message.pinnedAt ?? new Date()) : null },
    });
    await this.publishById(membership, message.id);
  }

  /** A /poll vote; voting again for the option already chosen takes it back. */
  async vote(
    userId: string,
    messageId: string,
    optionId: string,
  ): Promise<MessageDto> {
    const { message, membership } = await this.memberMessage(userId, messageId);
    await this.ensureWritable(userId, peerOf(membership, userId));
    const poll = await this.prisma.messagePoll.findUnique({
      where: { messageId: message.id },
      select: {
        id: true,
        options: { select: { id: true } },
        votes: { where: { userId }, select: { optionId: true } },
      },
    });

    if (!poll?.options.some((option) => option.id === optionId)) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ChatPollOptionNotFound,
      );
    }

    if (poll.votes[0]?.optionId === optionId) {
      await this.prisma.messagePollVote.delete({
        where: { pollId_userId: { pollId: poll.id, userId } },
      });
    } else {
      await this.prisma.messagePollVote.upsert({
        where: { pollId_userId: { pollId: poll.id, userId } },
        create: { pollId: poll.id, optionId, userId },
        update: { optionId, createdAt: new Date() },
      });
    }

    await this.publishById(membership, message.id);
    const row = await this.prisma.message.findUniqueOrThrow({
      where: { id: message.id },
      include: MESSAGE_INCLUDE,
    });
    return this.dtoFor(row, userId);
  }

  /** What a /saga or /where card reads of its message, for a member. */
  async commandMessage(
    viewerId: string,
    messageId: string,
  ): Promise<CommandMessage> {
    const { message, membership } = await this.memberMessage(
      viewerId,
      messageId,
    );
    const row = await this.prisma.message.findUniqueOrThrow({
      where: { id: message.id },
      select: {
        id: true,
        sagaDomain: true,
        sagaKey: true,
        whereWork: true,
        embeds: {
          where: { position: 0 },
          select: { targetType: true, targetId: true, href: true },
        },
      },
    });
    return {
      id: row.id,
      sagaDomain: row.sagaDomain as Domain | null,
      sagaKey: row.sagaKey,
      whereWork: row.whereWork,
      work: row.embeds[0] ?? null,
      memberIds: membership.conversation.members.map((m) => m.userId),
    };
  }

  /** The conversation's members, the viewer among them (who /pick draws for). */
  async memberIds(viewerId: string, conversationId: string): Promise<string[]> {
    const membership = await this.membership(viewerId, conversationId);
    return membership.conversation.members.map((m) => m.userId);
  }

  /** The conversation's pinned messages, last pinned first. */
  async pins(viewerId: string, conversationId: string): Promise<MessageDto[]> {
    await this.membership(viewerId, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId, pinnedAt: { not: null }, deletedAt: null },
      orderBy: { pinnedAt: "desc" },
      take: PINNED_MESSAGES_MAX,
      include: MESSAGE_INCLUDE,
    });
    const cards = await this.cardsFor(viewerId, rows);
    return rows.map((row) => toMessageDto(row, viewerId, cards));
  }

  /** Messages whose text holds the query, newest first. */
  async search(
    viewerId: string,
    conversationId: string,
    query: string,
  ): Promise<MessageDto[]> {
    await this.membership(viewerId, conversationId);
    const needle = query.trim();
    if (needle.length < CHAT_SEARCH_MIN_LENGTH) return [];

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        text: { contains: needle, mode: "insensitive" },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MESSAGE_PAGE_SIZE,
      include: MESSAGE_INCLUDE,
    });
    const cards = await this.cardsFor(viewerId, rows);
    return rows.map((row) => toMessageDto(row, viewerId, cards));
  }

  /** Every work shared in the conversation, once each, last shared first. */
  async works(
    viewerId: string,
    conversationId: string,
  ): Promise<ConversationWorkDto[]> {
    await this.membership(viewerId, conversationId);
    const embeds = await this.prisma.messageEmbed.findMany({
      where: { message: { conversationId, deletedAt: null } },
      orderBy: [{ message: { createdAt: "desc" } }, { position: "asc" }],
      take: 500,
      include: { message: { select: { authorId: true, createdAt: true } } },
    });

    const seen = new Set<string>();
    const latest = embeds.filter((embed) => {
      if (seen.has(embed.href)) return false;
      seen.add(embed.href);
      return true;
    });
    const owned = await this.ownedWorks(viewerId, latest);

    return latest.map((embed) => ({
      kind: embed.kind as MessageWorkKind,
      title: embed.title,
      imageUrl: embed.imageUrl,
      href: embed.href,
      year: embed.year,
      inLibrary: owned.has(`${embed.targetType}:${embed.targetId}`),
      messageId: embed.messageId,
      sharedAt: embed.message.createdAt.toISOString(),
      mine: embed.message.authorId === viewerId,
    }));
  }

  /** Unread again from this message on, as if it had just arrived. */
  async markUnreadFrom(userId: string, messageId: string): Promise<void> {
    const { message } = await this.memberMessage(userId, messageId);
    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId,
        },
      },
      data: { lastReadAt: new Date(message.createdAt.getTime() - 1) },
    });
  }

  /**
   * "Transférer": a copy goes to each friend picked, in their conversation,
   * marked forwarded without saying whose it was. Every recipient is checked
   * before anything is sent.
   */
  async forward(
    userId: string,
    messageId: string,
    usernames: string[],
  ): Promise<number> {
    const { message } = await this.memberMessage(userId, messageId);
    const original = await this.prisma.message.findUniqueOrThrow({
      where: { id: message.id },
      include: {
        embeds: { orderBy: { position: "asc" } },
        poll: { select: { question: true } },
      },
    });

    const memberships: Membership[] = [];

    for (const username of usernames) {
      const conversation = await this.open(userId, username);

      if (conversation.id === message.conversationId) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.ChatForwardToOrigin,
        );
      }

      memberships.push(await this.membership(userId, conversation.id));
    }

    for (const membership of memberships) {
      await this.deliver(userId, membership, {
        // A poll's votes belong to its conversation: its question goes on.
        text: original.text ?? original.poll?.question ?? null,
        spoiler: original.spoiler,
        forwarded: true,
        reviewId: original.reviewId,
        listId: original.listId,
        sagaDomain: original.sagaDomain,
        sagaKey: original.sagaKey,
        pickDomain: original.pickDomain,
        pickShared: original.pickShared,
        pickCount: original.pickCount,
        whereWork: original.whereWork,
        embeds: original.embeds.map((embed) => ({
          targetType: embed.targetType,
          targetId: embed.targetId,
          kind: embed.kind as MessageWorkKind,
          title: embed.title,
          imageUrl: embed.imageUrl,
          href: embed.href,
          year: embed.year,
          position: embed.position,
        })),
      });
    }

    return memberships.length;
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
      await this.emitMessage(userId, row);
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
    await this.prisma.messagePoll.deleteMany({
      where: { message: { authorId: userId } },
    });
    await this.prisma.message.updateMany({
      where: { authorId: userId, deletedAt: null },
      data: {
        text: null,
        reviewId: null,
        listId: null,
        sagaDomain: null,
        sagaKey: null,
        pickDomain: null,
        pickShared: null,
        pickCount: null,
        whereWork: false,
        deletedAt: new Date(),
      },
    });
  }

  async purgeEmptyConversations(): Promise<void> {
    await this.prisma.conversation.deleteMany({
      where: { members: { none: {} } },
    });
  }

  private async dtoFor(row: MessageRow, viewerId: string): Promise<MessageDto> {
    return toMessageDto(row, viewerId, await this.cardsFor(viewerId, [row]));
  }

  private async cardsFor(
    viewerId: string,
    rows: MessageRow[],
  ): Promise<MessageCards> {
    const live = rows.filter((row) => !row.deletedAt);
    const idsOf = (ids: (string | null)[]) => [
      ...new Set(ids.filter((id): id is string => id !== null)),
    ];
    const [owned, reviews, lists] = await Promise.all([
      this.ownedWorks(
        viewerId,
        live.flatMap((row) => row.embeds),
      ),
      this.reviews.messageCards(idsOf(live.map((row) => row.reviewId))),
      this.lists.messageCards(viewerId, idsOf(live.map((row) => row.listId))),
    ]);
    return { owned, reviews, lists };
  }

  private async ensureOwnReview(
    authorId: string,
    reviewId: string,
  ): Promise<void> {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, userId: authorId },
      select: { id: true },
    });

    if (!review) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ChatReviewNotFound,
      );
    }
  }

  /** A list goes into a conversation only when both members may open it. */
  private async ensureSharedList(
    listId: string,
    memberIds: (string | undefined)[],
  ): Promise<void> {
    for (const userId of memberIds) {
      const visible =
        userId !== undefined &&
        (await this.lists.messageCards(userId, [listId])).has(listId);

      if (!visible) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.ChatListNotShareable,
        );
      }
    }
  }

  /** The works among these cards the viewer already tracks. */
  private async ownedWorks(
    userId: string,
    embeds: { targetType: string; targetId: string }[],
  ): Promise<Set<string>> {
    const idsOf = (type: string) => [
      ...new Set(
        embeds
          .filter((embed) => embed.targetType === type)
          .map((embed) => embed.targetId),
      ),
    ];
    const media = idsOf("MEDIA");
    const games = idsOf("GAME");
    const books = idsOf("BOOK");
    const music = idsOf("MUSIC");
    const owned = new Set<string>();

    const [mediaRows, gameRows, bookRows, musicRows] = await Promise.all([
      media.length > 0
        ? this.prisma.libraryEntry.findMany({
            where: { userId, mediaItemId: { in: media } },
            select: { mediaItemId: true },
          })
        : [],
      games.length > 0
        ? this.prisma.gameEntry.findMany({
            where: { userId, gameItemId: { in: games } },
            select: { gameItemId: true },
          })
        : [],
      books.length > 0
        ? this.prisma.bookEntry.findMany({
            where: { userId, bookItemId: { in: books } },
            select: { bookItemId: true },
          })
        : [],
      music.length > 0
        ? this.prisma.musicEntry.findMany({
            where: { userId, musicItemId: { in: music } },
            select: { musicItemId: true },
          })
        : [],
    ]);

    for (const row of mediaRows) owned.add(`MEDIA:${row.mediaItemId}`);
    for (const row of gameRows) owned.add(`GAME:${row.gameItemId}`);
    for (const row of bookRows) owned.add(`BOOK:${row.bookItemId}`);
    for (const row of musicRows) owned.add(`MUSIC:${row.musicItemId}`);
    return owned;
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
        pinnedAt: true,
        createdAt: true,
        text: true,
        spoiler: true,
        edited: true,
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
    const cards = await this.cardsFor(viewer.id, lastMessages);

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
          lastMessage: last ? toMessageDto(last, viewer.id, cards) : null,
          unread: unread.get(m.conversationId) ?? 0,
          lastReadAt: m.lastReadAt.toISOString(),
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
    await db.messagePoll.deleteMany({ where: { messageId } });
    return db.message.update({
      where: { id: messageId },
      data: {
        text: null,
        deletedAt: new Date(),
        deletedByAdmin: byAdmin,
        pinnedAt: null,
        reviewId: null,
        listId: null,
        sagaDomain: null,
        sagaKey: null,
        pickDomain: null,
        pickShared: null,
        pickCount: null,
        whereWork: false,
      },
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
    await this.publish(membership, row);
  }

  /**
   * Each member gets the message as they see it (`mine`, `myReaction`, the
   * cards of the works they already track).
   */
  private async publish(
    membership: Membership,
    row: MessageRow,
  ): Promise<void> {
    for (const member of membership.conversation.members) {
      await this.emitMessage(member.userId, row);
    }
  }

  private async emitMessage(userId: string, row: MessageRow): Promise<void> {
    const event: ChatMessageEvent = {
      conversationId: row.conversationId,
      message: await this.dtoFor(row, userId),
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
        readAlertPrefs(recipient.alertPrefs),
        "CHAT_MESSAGE",
        "push",
      )
    ) {
      return;
    }

    const copy = notificationCopy(recipient.locale);

    try {
      await this.push.sendToUser(recipientId, {
        title: author.displayName,
        body: copy.chatMessage,
        url: `/app?messages=${conversationId}`,
        tag: `chat:${conversationId}`,
        group: AlertGroup.ACTIVITY,
        actions: [
          {
            action: NotificationAction.CHAT_REPLY,
            label: copy.pushActions.reply,
            replyHint: copy.pushActions.replyHint,
            target: { conversationId },
          },
          {
            action: NotificationAction.CHAT_READ,
            label: copy.pushActions.markRead,
            target: { conversationId },
          },
        ],
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

function toMessageDto(
  row: MessageRow,
  viewerId: string,
  cards: MessageCards,
): MessageDto {
  const counts = new Map<CommentEmote, number>();
  let myReaction: CommentEmote | null = null;

  for (const reaction of row.reactions) {
    counts.set(reaction.emote, (counts.get(reaction.emote) ?? 0) + 1);
    if (reaction.userId === viewerId) myReaction = reaction.emote;
  }

  const reactions: CommentReactionSummaryDto[] = [...counts].map(
    ([emote, count]) => ({ emote, count }),
  );
  const review = row.reviewId
    ? (cards.reviews.get(row.reviewId) ?? null)
    : null;
  const list = row.listId ? (cards.lists.get(row.listId) ?? null) : null;

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
      : row.embeds.map(({ targetType, targetId, ...embed }) => ({
          ...embed,
          kind: embed.kind as MessageWorkKind,
          inLibrary: cards.owned.has(`${targetType}:${targetId}`),
        })),
    review,
    list,
    gone:
      row.reviewId && !review ? "review" : row.listId && !list ? "list" : null,
    poll: row.deletedAt ? null : toPollDto(row.poll, viewerId),
    saga:
      !row.deletedAt && row.sagaDomain && row.sagaKey
        ? {
            domain: row.sagaDomain as MessageSagaRefDto["domain"],
            key: row.sagaKey,
          }
        : null,
    pick:
      !row.deletedAt && row.pickDomain
        ? {
            domain: row.pickDomain as MessagePickDto["domain"],
            shared: row.pickShared ?? false,
            count: row.pickCount ?? 0,
          }
        : null,
    where: !row.deletedAt && row.whereWork,
    pinned: row.pinnedAt !== null,
    forwarded: row.forwarded,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPollDto(
  poll: MessageRow["poll"],
  viewerId: string,
): MessagePollDto | null {
  if (!poll) return null;
  return {
    question: poll.question,
    options: poll.options.map((option) => ({
      ...option,
      voters: poll.votes
        .filter((vote) => vote.optionId === option.id)
        .map((vote) => toUserSummaryDto(vote.user)),
    })),
    myVote:
      poll.votes.find((vote) => vote.userId === viewerId)?.optionId ?? null,
  };
}
