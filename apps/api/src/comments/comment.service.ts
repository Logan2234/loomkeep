import {
  type AdminUserCommentDto,
  type CommentDto,
  type CommentEmote,
  type CommentReactionSummaryDto,
  type CommentTargetType,
  type PagedResult,
  COMMENT_REACTION_NOTIFY_THRESHOLD,
  ErrorCode,
  NotificationType,
  ProfileAccess,
  XpReason,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { resolveWorkHref } from "../common/work-href.util";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { ACHIEVEMENT_KEYS_ON_COMMENT_POSTED } from "../gamification/achievements/registry";
import { isGamificationEnabled } from "../gamification/gamification.config";
import { fetchXpByUser, withXp } from "../gamification/xp-lookup.util";
import { XpService } from "../gamification/xp.service";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { BlockService } from "../social/block.service";
import { anonymizeAuthor } from "../social/pseudonym.util";
import { VisibilityService } from "../social/visibility.service";
import { fetchStreaksByUser, withStreakDays } from "../stats/streak.util";
import { toUserSummaryDto } from "../users/avatar.util";
import type { CreateCommentBody } from "./dto/create-comment.dto";
import type { UpdateCommentBody } from "./dto/update-comment.dto";
import { extractMentions } from "./mention.util";

export const COMMENT_PAGE_SIZE = 20;
const EXCERPT_LENGTH = 120;

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
  // Only ever used locally to build the withXp gating map below — never
  // forwarded to toUserSummaryDto/the client (that would leak the setting
  // itself, not just its effect).
  hideProgression: true,
} as const;

type CommentAuthor = {
  id: string;
  username: string;
  displayName: string;
  profileAccess: ProfileAccess;
  avatarUpdatedAt: Date | null;
  hideProgression: boolean;
};

type CommentRow = {
  id: string;
  targetType: string;
  targetId: string;
  parentId: string | null;
  authorId: string | null;
  text: string | null;
  spoilerTag: boolean;
  edited: boolean;
  deletedAt: Date | null;
  deletedByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Null once the author's account has been deleted (authorId SetNull) —
  // the content stays, the client renders "Utilisateur supprimé".
  author: CommentAuthor | null;
};

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly notifications: NotificationService,
    private readonly xp: XpService,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly achievements: AchievementService,
    private readonly blocks: BlockService,
  ) {}

  /**
   * A page of top-level comments for a target (newest first, YouTube-style),
   * each with its replies attached (oldest first, conversation order). Rows
   * from a blocked relationship (either direction) are dropped after the page
   * is fetched, so a page can come back smaller than `limit` when blocks
   * are involved — accepted, matches how listForTarget already filters
   * reviews.
   */
  async list(
    viewerId: string,
    targetType: CommentTargetType,
    targetId: string,
    page = 1,
    limit = COMMENT_PAGE_SIZE,
  ): Promise<PagedResult<CommentDto>> {
    const rows = await this.prisma.comment.findMany({
      where: { targetType, targetId, parentId: null },
      // Newest first (YouTube-style) — a fresh comment is visible right away
      // instead of requiring "load more" clicks through the whole history.
      // Replies stay oldest-first (conversation order) — see below.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: { author: { select: AUTHOR_SELECT } },
    });

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const visible = await this.filterBlocked(viewerId, pageRows);

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
    const authorIds = allComments
      .map((c) => c.author?.id)
      .filter((id): id is string => !!id);
    const uniqueAuthorIds = [...new Set(authorIds)];
    const [[reactionMap, myReactionMap], streakMap, xpMap] = await Promise.all([
      this.loadReactions(viewerId, allIds),
      fetchStreaksByUser(this.prisma, uniqueAuthorIds),
      fetchXpByUser(this.prisma, uniqueAuthorIds),
    ]);
    // Same rows AUTHOR_SELECT already fetched for profileAccess/anonymized —
    // reused here instead of a second query (see xp-lookup.util.ts's doc
    // comment on withXp).
    const hideProgressionByUser = new Map(
      allComments
        .filter((c) => c.author)
        .map((c) => [c.author!.id, c.author!.hideProgression]),
    );

    const toDtoWithMask = async (row: CommentRow): Promise<CommentDto> =>
      this.toDto(
        row,
        reactionMap,
        myReactionMap,
        viewerId,
        streakMap,
        xpMap,
        hideProgressionByUser,
      );

    const repliesByParent = new Map<string, CommentRow[]>();

    for (const r of visibleReplies) {
      const arr = repliesByParent.get(r.parentId!) ?? [];
      arr.push(r);
      repliesByParent.set(r.parentId!, arr);
    }

    const items = await Promise.all(
      visible.map(async (c) => {
        const dto = await toDtoWithMask(c);
        dto.replies = await Promise.all(
          (repliesByParent.get(c.id) ?? []).map(toDtoWithMask),
        );
        return dto;
      }),
    );

    return { items, hasMore };
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
      where: { authorId, deletedAt: null, targetType: { not: "MUSIC" } },
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
      authorId: string | null;
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
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.CommentParentNotFound,
        );
      }

      parent = found;
    }

    // A reply always targets whatever its parent targets — trusting the
    // client's own targetType/targetId here would let a reply's masking rules
    // (e.g. MUSIC, never masked) diverge from the thread it actually lives in.
    const targetType = parent?.targetType ?? body.targetType;
    const targetId = parent?.targetId ?? body.targetId;
    if (targetType === "MUSIC") {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);
    }
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

    await this.notifyOnCreate(authorId, row, parent);

    // Checked here rather than left to award() (which credits blindly) —
    // unlike the review text-length case, a too-short comment is a frequent,
    // immediate scenario, not a rare edge case worth deferring to the
    // nightly reconciliation.
    if ((row.text?.trim().length ?? 0) >= 15) {
      await this.xp.award(authorId, XpReason.COMMENT_POSTED, row.id);
    }

    // first_comment/chatterbox_*/icebreaker unlock off any posted comment,
    // independent of the 15-char XP threshold above.
    await this.achievements.evaluate(
      authorId,
      ACHIEVEMENT_KEYS_ON_COMMENT_POSTED,
    );

    const [[reactionMap, myReactionMap], streakMap, xpMap] = await Promise.all([
      this.loadReactions(authorId, [row.id]),
      fetchStreaksByUser(this.prisma, [authorId]),
      fetchXpByUser(this.prisma, [authorId]),
    ]);
    const hideProgressionByUser = new Map(
      row.author ? [[row.author.id, row.author.hideProgression]] : [],
    );
    const dto = await this.toDto(
      row,
      reactionMap,
      myReactionMap,
      authorId,
      streakMap,
      xpMap,
      hideProgressionByUser,
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
    if (!existing || existing.deletedAt)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);
    if (existing.targetType === "MUSIC")
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);
    if (existing.authorId !== authorId)
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.CommentForbidden);

    const spoilerTag =
      existing.targetType === "MUSIC" ? false : !!body.spoilerTag;

    const row = await this.prisma.comment.update({
      where: { id },
      data: { text: body.text, spoilerTag, edited: true },
      include: { author: { select: AUTHOR_SELECT } },
    });

    const [[reactionMap, myReactionMap], streakMap, xpMap] = await Promise.all([
      this.loadReactions(authorId, [row.id]),
      fetchStreaksByUser(this.prisma, [authorId]),
      fetchXpByUser(this.prisma, [authorId]),
    ]);
    const hideProgressionByUser = new Map(
      row.author ? [[row.author.id, row.author.hideProgression]] : [],
    );
    const dto = await this.toDto(
      row,
      reactionMap,
      myReactionMap,
      authorId,
      streakMap,
      xpMap,
      hideProgressionByUser,
    );
    dto.replies = [];
    return dto;
  }

  /** Soft-delete: clears the text and tombstones the row so replies stay attached. */
  async remove(authorId: string, id: string): Promise<void> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);
    if (existing.authorId !== authorId)
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.CommentForbidden);

    await this.softDelete(id, false);
    await this.xp.revokeBySource("Comment", [id]);
  }

  /**
   * Admin takedown (moderation): same tombstone, no ownership check. Returns
   * the pre-tombstone author/text so the caller can build the DSA art. 17
   * notice (and keep an evidence snapshot) before the public text is nulled.
   */
  async adminRemove(
    id: string,
  ): Promise<{ authorId: string | null; text: string | null }> {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);

    await this.softDelete(id, true);
    await this.xp.revokeBySource("Comment", [id]);
    return { authorId: existing.authorId, text: existing.text };
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
      select: { id: true, deletedAt: true, authorId: true, targetType: true },
    });
    if (!comment || comment.deletedAt)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);
    if (comment.targetType === "MUSIC")
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);

    const reaction = await this.prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: { emote },
      create: { commentId, userId, emote },
    });

    // Credited to the comment's author, never the reactor — no UP/DOWN
    // distinction here (unlike ReviewVote), the barème has no exclusion.
    if (comment.authorId) {
      await this.xp.award(
        comment.authorId,
        XpReason.COMMENT_REACTION_RECEIVED,
        reaction.id,
      );
    }

    await this.maybeNotifyReactionThreshold(commentId, comment.authorId);
  }

  async unreact(userId: string, commentId: string): Promise<void> {
    // Looked up before the delete so revokeBySource still has the id to
    // work with afterwards.
    const existing = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: { id: true },
    });

    await this.prisma.commentReaction.deleteMany({
      where: { commentId, userId },
    });

    if (existing) {
      await this.xp.revokeBySource("CommentReaction", [existing.id]);
    }
  }

  // --- internals ---

  private async filterBlocked(
    viewerId: string,
    rows: CommentRow[],
  ): Promise<CommentRow[]> {
    const visible: CommentRow[] = [];

    for (const row of rows) {
      if (row.authorId === viewerId || !row.author) {
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
    xpMap: Map<string, number>,
    hideProgressionByUser: Map<string, boolean>,
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
      author: row.author
        ? withXp(
            withStreakDays(
              anonymizeAuthor(
                toUserSummaryDto(row.author),
                viewerId,
                row.targetType,
                row.targetId,
              ),
              streakMap,
            ),
            viewerId,
            xpMap,
            isGamificationEnabled(this.config, this.flags),
            hideProgressionByUser,
          )
        : null,
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
    authorId: string,
    row: CommentRow,
    parent: { id: string; authorId: string | null } | null,
  ): Promise<void> {
    const notifiedIds = new Set<string>([authorId]);

    if (parent?.authorId && !notifiedIds.has(parent.authorId)) {
      if (await this.mayNotify(authorId, parent.authorId)) {
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

      if (await this.mayNotify(authorId, userId)) {
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
    return !(await this.blocks.isBlockedEitherWay(actorId, recipientId));
  }

  private async notify(
    recipientId: string,
    row: CommentRow,
    type:
      | typeof NotificationType.COMMENT_REPLY
      | typeof NotificationType.COMMENT_MENTION,
  ): Promise<void> {
    // Guard only — a freshly created comment always has its author attached
    // (the acting, authenticated user), so this never actually fires.
    if (!row.author) return;

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
    authorId: string | null,
  ): Promise<void> {
    // A deleted author can't receive notifications.
    if (!authorId) return;

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
