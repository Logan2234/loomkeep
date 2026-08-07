import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type AdminUserCommentDto,
  type CommentDto,
  type CommentEmote,
  type CommentPageDto,
  type CommentReactionSummaryDto,
  type CommentTargetType,
  COMMENT_REACTION_NOTIFY_THRESHOLD,
  NotificationType,
  ProfileAccess,
} from "@loomkeep/shared";
import { resolveWorkHref } from "../common/work-href.util";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { anonymizeAuthor } from "../social/pseudonym.util";
import { VisibilityService } from "../social/visibility.service";
import { fetchStreaksByUser, withStreakDays } from "../stats/streak.util";
import { toUserSummaryDto } from "../users/avatar.util";
import type { CreateCommentBody } from "./dto/create-comment.dto";
import type { UpdateCommentBody } from "./dto/update-comment.dto";
import { extractMentions } from "./mention.util";

const PAGE_SIZE = 20;
const EXCERPT_LENGTH = 120;

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
} as const;

type CommentAuthor = {
  id: string;
  username: string;
  displayName: string;
  profileAccess: ProfileAccess;
  avatarUpdatedAt: Date | null;
};

type CommentRow = {
  id: string;
  targetType: string;
  targetId: string;
  parentId: string | null;
  authorId: string;
  text: string | null;
  spoilerTag: boolean;
  edited: boolean;
  deletedAt: Date | null;
  deletedByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthor;
};

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * A page of top-level comments for a target (newest first, YouTube-style),
   * each with its replies attached (oldest first, conversation order). Rows
   * from a blocked relationship (either direction) are dropped after the page
   * is fetched, so a page can come back smaller than PAGE_SIZE when blocks
   * are involved — accepted, matches how listForTarget already filters
   * reviews.
   */
  async list(
    viewerId: string,
    targetType: CommentTargetType,
    targetId: string,
    cursor?: string,
  ): Promise<CommentPageDto> {
    const rows = await this.prisma.comment.findMany({
      where: { targetType, targetId, parentId: null },
      // Newest first (YouTube-style) — a fresh comment is visible right away
      // instead of requiring "load more" clicks through the whole history.
      // Replies stay oldest-first (conversation order) — see below.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { author: { select: AUTHOR_SELECT } },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    const visible = await this.filterBlocked(viewerId, page);

    const replyRows = visible.length
      ? await this.prisma.comment.findMany({
          where: { parentId: { in: visible.map((c) => c.id) } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { author: { select: AUTHOR_SELECT } },
        })
      : [];
    const visibleReplies = await this.filterBlocked(viewerId, replyRows);

    const allComments = [...visible, ...visibleReplies];
    const allIds = allComments.map((c) => c.id);
    const [[reactionMap, myReactionMap], streakMap] = await Promise.all([
      this.loadReactions(viewerId, allIds),
      fetchStreaksByUser(this.prisma, [
        ...new Set(allComments.map((c) => c.author.id)),
      ]),
    ]);

    const toDtoWithMask = async (row: CommentRow): Promise<CommentDto> =>
      this.toDto(row, reactionMap, myReactionMap, viewerId, streakMap);

    const repliesByParent = new Map<string, CommentRow[]>();

    for (const r of visibleReplies) {
      const arr = repliesByParent.get(r.parentId!) ?? [];
      arr.push(r);
      repliesByParent.set(r.parentId!, arr);
    }

    const comments = await Promise.all(
      visible.map(async (c) => {
        const dto = await toDtoWithMask(c);
        dto.replies = await Promise.all(
          (repliesByParent.get(c.id) ?? []).map(toDtoWithMask),
        );
        return dto;
      }),
    );

    return {
      comments,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Total comment count (top-level + replies, deleted excluded) for a target. */
  async count(
    targetType: CommentTargetType,
    targetId: string,
  ): Promise<number> {
    return this.prisma.comment.count({
      where: { targetType, targetId, deletedAt: null },
    });
  }

  /** Comments authored by a user, for the admin user drawer's "Commentaires" shortcut. */
  async listByAuthor(authorId: string): Promise<AdminUserCommentDto[]> {
    const rows = await this.prisma.comment.findMany({
      where: { authorId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        text: true,
        targetType: true,
        targetId: true,
        createdAt: true,
      },
    });

    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        excerpt: (r.text ?? "").slice(0, EXCERPT_LENGTH),
        href: await resolveWorkHref(this.prisma, r.targetType, r.targetId),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }

  async create(authorId: string, body: CreateCommentBody): Promise<CommentDto> {
    let parent: {
      id: string;
      authorId: string;
      targetType: CommentTargetType;
      targetId: string;
    } | null = null;

    if (body.parentId) {
      const found = await this.prisma.comment.findUnique({
        where: { id: body.parentId },
        select: {
          id: true,
          authorId: true,
          parentId: true,
          targetType: true,
          targetId: true,
        },
      });

      if (!found || found.parentId) {
        // Flat + one level: replying to a reply is rejected, the client
        // should have offered "reply" only on top-level comments.
        throw new NotFoundException("Parent comment not found");
      }

      parent = found;
    }

    // A reply always targets whatever its parent targets — trusting the
    // client's own targetType/targetId here would let a reply's masking rules
    // (e.g. MUSIC, never masked) diverge from the thread it actually lives in.
    const targetType = parent?.targetType ?? body.targetType;
    const targetId = parent?.targetId ?? body.targetId;
    const spoilerTag = targetType === "MUSIC" ? false : !!body.spoilerTag;

    const row = await this.prisma.comment.create({
      data: {
        targetType,
        targetId,
        parentId: body.parentId ?? null,
        authorId,
        text: body.text,
        spoilerTag,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    await this.notifyOnCreate(row, parent);

    const [[reactionMap, myReactionMap], streakMap] = await Promise.all([
      this.loadReactions(authorId, [row.id]),
      fetchStreaksByUser(this.prisma, [authorId]),
    ]);
    const dto = await this.toDto(
      row,
      reactionMap,
      myReactionMap,
      authorId,
      streakMap,
    );
    dto.replies = [];
    return dto;
  }

  async update(
    authorId: string,
    id: string,
    body: UpdateCommentBody,
  ): Promise<CommentDto> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException();
    if (existing.authorId !== authorId) throw new ForbiddenException();

    const spoilerTag =
      existing.targetType === "MUSIC" ? false : !!body.spoilerTag;

    const row = await this.prisma.comment.update({
      where: { id },
      data: { text: body.text, spoilerTag, edited: true },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const [[reactionMap, myReactionMap], streakMap] = await Promise.all([
      this.loadReactions(authorId, [row.id]),
      fetchStreaksByUser(this.prisma, [authorId]),
    ]);
    const dto = await this.toDto(
      row,
      reactionMap,
      myReactionMap,
      authorId,
      streakMap,
    );
    dto.replies = [];
    return dto;
  }

  /** Soft-delete: clears the text and tombstones the row so replies stay attached. */
  async remove(authorId: string, id: string): Promise<void> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException();
    if (existing.authorId !== authorId) throw new ForbiddenException();

    await this.softDelete(id, false);
  }

  /** Admin takedown (moderation): same tombstone, no ownership check. */
  async adminRemove(id: string): Promise<void> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException();

    await this.softDelete(id, true);
  }

  private async softDelete(id: string, byAdmin: boolean): Promise<void> {
    await this.prisma.comment.update({
      where: { id },
      data: { text: null, deletedAt: new Date(), deletedByAdmin: byAdmin },
    });
  }

  /** Upserts the viewer's reaction on a comment (a 2nd emote replaces the 1st). */
  async react(
    userId: string,
    commentId: string,
    emote: CommentEmote,
  ): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, deletedAt: true, authorId: true },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException();

    await this.prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: { emote },
      create: { commentId, userId, emote },
    });

    await this.maybeNotifyReactionThreshold(commentId, comment.authorId);
  }

  async unreact(userId: string, commentId: string): Promise<void> {
    await this.prisma.commentReaction.deleteMany({
      where: { commentId, userId },
    });
  }

  // --- internals ---

  private async filterBlocked(
    viewerId: string,
    rows: CommentRow[],
  ): Promise<CommentRow[]> {
    const visible: CommentRow[] = [];

    for (const row of rows) {
      if (row.authorId === viewerId) {
        visible.push(row);
        continue;
      }

      const relation = await this.visibility.getRelation(viewerId, {
        id: row.author.id,
        profileAccess: row.author.profileAccess,
      });
      if (!relation.blocking && !relation.blockedByTarget) visible.push(row);
    }

    return visible;
  }

  private async loadReactions(
    viewerId: string,
    commentIds: string[],
  ): Promise<
    [Map<string, CommentReactionSummaryDto[]>, Map<string, CommentEmote>]
  > {
    if (commentIds.length === 0) return [new Map(), new Map()];

    const rows = await this.prisma.commentReaction.findMany({
      where: { commentId: { in: commentIds } },
      select: { commentId: true, userId: true, emote: true },
    });

    const counts = new Map<string, Map<CommentEmote, number>>();
    const mine = new Map<string, CommentEmote>();

    for (const r of rows) {
      if (r.userId === viewerId) mine.set(r.commentId, r.emote);
      const byEmote = counts.get(r.commentId) ?? new Map();
      byEmote.set(r.emote, (byEmote.get(r.emote) ?? 0) + 1);
      counts.set(r.commentId, byEmote);
    }

    const summaries = new Map<string, CommentReactionSummaryDto[]>();

    for (const [commentId, byEmote] of counts) {
      summaries.set(
        commentId,
        [...byEmote.entries()].map(([emote, count]) => ({ emote, count })),
      );
    }

    return [summaries, mine];
  }

  private async toDto(
    row: CommentRow,
    reactionMap: Map<string, CommentReactionSummaryDto[]>,
    myReactionMap: Map<string, CommentEmote>,
    viewerId: string,
    streakMap: Map<string, number>,
  ): Promise<CommentDto> {
    const masked = row.deletedAt
      ? false
      : this.isMasked(row.targetType as CommentTargetType, row.spoilerTag);

    return {
      id: row.id,
      targetType: row.targetType as CommentTargetType,
      targetId: row.targetId,
      parentId: row.parentId,
      text: row.deletedAt ? null : row.text,
      deleted: !!row.deletedAt,
      deletedByAdmin: row.deletedByAdmin,
      edited: row.edited,
      spoilerTag: row.spoilerTag,
      masked,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: withStreakDays(
        anonymizeAuthor(
          toUserSummaryDto(row.author),
          viewerId,
          row.targetType,
          row.targetId,
        ),
        streakMap,
      ),
      reactions: reactionMap.get(row.id) ?? [],
      myReaction: myReactionMap.get(row.id) ?? null,
      replies: [],
    };
  }

  /**
   * Whether a comment should render blurred right now: purely the author's
   * own spoiler tag (V2: no auto progression-based gate — the viewer is
   * trusted to have tagged it correctly). MUSIC is never masked (no
   * narrative to spoil), even if a row somehow carries the tag.
   */
  private isMasked(
    targetType: CommentTargetType,
    spoilerTag: boolean,
  ): boolean {
    return targetType !== "MUSIC" && spoilerTag;
  }

  private async notifyOnCreate(
    row: CommentRow,
    parent: { id: string; authorId: string } | null,
  ): Promise<void> {
    const notifiedIds = new Set<string>([row.authorId]);

    if (parent && !notifiedIds.has(parent.authorId)) {
      if (await this.mayNotify(row.authorId, parent.authorId)) {
        await this.notify(parent.authorId, row, NotificationType.COMMENT_REPLY);
        notifiedIds.add(parent.authorId);
      }
    }

    const mentions = extractMentions(row.text ?? "");
    if (mentions.length === 0) return;

    // Figurants are unaddressable: excluded so they're never mentioned/notified.
    const mentioned = await this.prisma.user.findMany({
      where: {
        username: { in: mentions },
        profileAccess: { not: ProfileAccess.GHOST },
      },
      select: { id: true },
    });

    for (const { id: userId } of mentioned) {
      if (notifiedIds.has(userId)) continue;

      if (await this.mayNotify(row.authorId, userId)) {
        await this.notify(userId, row, NotificationType.COMMENT_MENTION);
        notifiedIds.add(userId);
      }
    }
  }

  /** A block in either direction neutralizes the notification. */
  private async mayNotify(
    actorId: string,
    recipientId: string,
  ): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: actorId, blockedId: recipientId },
          { blockerId: recipientId, blockedId: actorId },
        ],
      },
      select: { id: true },
    });
    return !block;
  }

  private async notify(
    recipientId: string,
    row: CommentRow,
    type:
      | typeof NotificationType.COMMENT_REPLY
      | typeof NotificationType.COMMENT_MENTION,
  ): Promise<void> {
    const url = await resolveWorkHref(
      this.prisma,
      row.targetType,
      row.targetId,
    );
    const excerpt = (row.text ?? "").slice(0, EXCERPT_LENGTH);

    await this.notifications.create({
      userId: recipientId,
      type,
      title: row.author.displayName,
      body: excerpt,
      url,
      dedupeKey: `${type.toLowerCase()}:${row.id}:${recipientId}`,
      data: {
        actorUsername: row.author.username,
        actorDisplayName: row.author.displayName,
      },
    });
  }

  private async maybeNotifyReactionThreshold(
    commentId: string,
    authorId: string,
  ): Promise<void> {
    const count = await this.prisma.commentReaction.count({
      where: { commentId },
    });
    if (count !== COMMENT_REACTION_NOTIFY_THRESHOLD) return;

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { targetType: true, targetId: true },
    });
    if (!comment) return;

    const url = await resolveWorkHref(
      this.prisma,
      comment.targetType,
      comment.targetId,
    );

    await this.notifications.create({
      userId: authorId,
      type: NotificationType.COMMENT_REACTIONS,
      title: "Ton commentaire fait réagir",
      body: `${COMMENT_REACTION_NOTIFY_THRESHOLD} réactions`,
      url,
      dedupeKey: `reactions:${commentId}:${COMMENT_REACTION_NOTIFY_THRESHOLD}`,
    });
  }
}
