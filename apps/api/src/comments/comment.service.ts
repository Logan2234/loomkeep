import {
  type AdminUserCommentDto,
  type CommentDto,
  type CommentEmote,
  type CommentMentionDto,
  type CommentMentionInputDto,
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
import type { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { DEFAULT_PAGE_SIZE } from "../common/pagination.util";
import { resolveWorkHref, workTargetExists } from "../common/work-href.util";
import { EventsGateway } from "../events/events.gateway";
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
import { toUserSummaryDto } from "../users/avatar.util";
import type { CreateCommentBody } from "./dto/create-comment.dto";
import type { UpdateCommentBody } from "./dto/update-comment.dto";

// Alias kept only so CommentController's existing import still resolves —
// the page size itself is now the shared one from pagination.util.
export { DEFAULT_PAGE_SIZE as COMMENT_PAGE_SIZE } from "../common/pagination.util";

const EXCERPT_LENGTH = 120;

/**
 * How many replies a top-level comment carries inline in a list page. A
 * thread has no cap on replies, so embedding all of them made one popular
 * comment able to grow the response without bound — the rest now comes from
 * `listReplies` on demand.
 */
export const REPLY_PREVIEW_LIMIT = 3;

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
  mentions?: {
    userId: string;
    start: number;
    user: { id: string; username: string } | null;
  }[];
  // Only on rows read by `list`: the inline reply preview and the total the
  // preview is a subset of.
  replies?: CommentRow[];
  _count?: { replies: number };
};

const MENTION_SELECT = {
  userId: true,
  start: true,
  user: { select: { id: true, username: true } },
} as const;

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
    private readonly events: EventsGateway,
  ) {}

  /**
   * A page of top-level comments for a target (newest first, YouTube-style),
   * each carrying only its {@link REPLY_PREVIEW_LIMIT} most recent replies
   * (oldest first within the preview, conversation order) plus a total in
   * `replyCount` — `listReplies` serves the rest. Rows from a blocked
   * relationship (either direction) are dropped after the page is fetched, so
   * a page can come back smaller than `limit` when blocks are involved —
   * accepted, matches how listForTarget already filters reviews.
   */
  async list(
    viewerId: string,
    targetType: CommentTargetType,
    targetId: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<PagedResult<CommentDto>> {
    const rows = (await this.prisma.comment.findMany({
      where: { targetType, targetId, parentId: null },
      // Newest first (YouTube-style) — a fresh comment is visible right away
      // instead of requiring "load more" clicks through the whole history.
      // Replies stay oldest-first (conversation order) — see below.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: {
        author: { select: AUTHOR_SELECT },
        mentions: { select: MENTION_SELECT },
        // Negative take against an ascending order = the *last* N rows, still
        // returned oldest-first, so the preview reads as the tail of the
        // conversation without a second sort here.
        replies: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: -REPLY_PREVIEW_LIMIT,
          include: {
            author: { select: AUTHOR_SELECT },
            mentions: { select: MENTION_SELECT },
          },
        },
        _count: { select: { replies: { where: { deletedAt: null } } } },
      },
    })) as CommentRow[];

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const visible = await this.filterBlocked(viewerId, pageRows);

    const previewRows = visible.flatMap((c) => c.replies ?? []);
    const visibleReplies = await this.filterBlocked(viewerId, previewRows);
    const visibleReplyIds = new Set(visibleReplies.map((r) => r.id));

    const toDtoWithMask = await this.dtoMapper(viewerId, [
      ...visible,
      ...visibleReplies,
    ]);

    const items = await Promise.all(
      visible.map(async (c) => {
        const dto = await toDtoWithMask(c);
        dto.replies = await Promise.all(
          (c.replies ?? [])
            .filter((r) => visibleReplyIds.has(r.id))
            .map(toDtoWithMask),
        );
        // Not block-filtered, unlike `replies` above: that would mean running
        // every reply of every comment through getRelation just to subtract
        // the few a block hides. The count can therefore read one or two high
        // for a viewer with blocks — the reply list itself stays correct.
        dto.replyCount = c._count?.replies ?? 0;
        return dto;
      }),
    );

    return { items, hasMore };
  }

  /**
   * A page of one comment's replies, newest first — the client accumulates
   * pages and reverses them for display, so "show earlier replies" keeps
   * walking backwards from the preview `list` already returned instead of
   * restarting at the top of the thread.
   */
  async listReplies(
    viewerId: string,
    parentId: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<PagedResult<CommentDto>> {
    const rows = (await this.prisma.comment.findMany({
      where: { parentId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: {
        author: { select: AUTHOR_SELECT },
        mentions: { select: MENTION_SELECT },
      },
    })) as CommentRow[];

    const hasMore = rows.length > limit;
    const visible = await this.filterBlocked(viewerId, rows.slice(0, limit));
    const toDtoWithMask = await this.dtoMapper(viewerId, visible);

    return { items: await Promise.all(visible.map(toDtoWithMask)), hasMore };
  }

  /**
   * Loads the reaction and XP lookups every row in `rows` needs, once, and
   * returns the row-to-DTO mapper closed over them — the alternative is those
   * two queries per comment.
   */
  private async dtoMapper(
    viewerId: string,
    rows: CommentRow[],
  ): Promise<(row: CommentRow) => Promise<CommentDto>> {
    const authorIds = rows
      .map((c) => c.author?.id)
      .filter((id): id is string => !!id);
    const [[reactionMap, myReactionMap], xpMap] = await Promise.all([
      this.loadReactions(
        viewerId,
        rows.map((c) => c.id),
      ),
      fetchXpByUser(this.prisma, [...new Set(authorIds)]),
    ]);
    // Same rows AUTHOR_SELECT already fetched for profileAccess/anonymized —
    // reused here instead of a second query (see xp-lookup.util.ts's doc
    // comment on withXp).
    const hideProgressionByUser = new Map(
      rows
        .filter((c) => c.author)
        .map((c) => [c.author!.id, c.author!.hideProgression]),
    );

    return (row) =>
      this.toDto(
        row,
        reactionMap,
        myReactionMap,
        viewerId,
        xpMap,
        hideProgressionByUser,
      );
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

  /**
   * People who most recently spoke in a thread, for the mention picker. This
   * is intentionally scoped to the thread: mentions stay conversational and
   * never turn into a global people search.
   */
  async participants(
    viewerId: string,
    targetType: CommentTargetType,
    targetId: string,
    query?: string,
  ) {
    const username = query?.trim().toLowerCase();
    const rows = await this.prisma.comment.findMany({
      where: {
        targetType,
        targetId,
        deletedAt: null,
        authorId: { not: null },
        author: {
          is: {
            profileAccess: { not: ProfileAccess.GHOST },
            ...(username
              ? { username: { contains: username, mode: "insensitive" } }
              : {}),
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      distinct: ["authorId"],
      // Collect a few extra rows before block filtering, so a blocked recent
      // author does not leave an otherwise busy conversation empty.
      take: 20,
      select: {
        authorId: true,
        author: { select: AUTHOR_SELECT },
      },
    });

    const participants = [];

    for (const row of rows) {
      if (!row.author) continue;
      if (row.authorId === viewerId) continue;
      const relation = await this.visibility.getRelation(viewerId, {
        id: row.author.id,
        profileAccess: row.author.profileAccess,
      });
      if (relation.blocking || relation.blockedByTarget) continue;
      participants.push(toUserSummaryDto(row.author));
      if (participants.length === 5) break;
    }

    return participants;
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
          deletedAt: true,
          targetType: true,
          targetId: true,
        },
      });

      if (!found || found.deletedAt || found.parentId) {
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

    // Only for a root comment: a reply inherits its parent's target, which was
    // checked when that parent was created. Comments carry no foreign key to
    // the work (the pair is polymorphic), so nothing else stops a made-up
    // targetId from producing a comment attached to nothing — invisible in the
    // UI, but real in the table and in every moderation view.
    if (
      !parent &&
      !(await workTargetExists(this.prisma, targetType, targetId))
    ) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.CommentUnknownTargetType,
      );
    }

    await this.ensureParticipationAllowed(authorId, targetType, targetId);

    if (parent?.authorId) {
      await this.ensureInteractionNotBlocked(authorId, parent.authorId);
    }

    const spoilerTag = targetType === "MUSIC" ? false : !!body.spoilerTag;
    const mentions = await this.resolveMentions(
      authorId,
      targetType,
      targetId,
      body.text,
      body.mentions,
    );

    const row = await this.prisma.comment.create({
      data: {
        targetType,
        targetId,
        parentId: body.parentId ?? null,
        authorId,
        text: body.text,
        spoilerTag,
        mentions: {
          create: mentions,
        },
      },
      include: {
        author: { select: AUTHOR_SELECT },
        mentions: { select: MENTION_SELECT },
      },
    });

    await this.notifyOnCreate(
      authorId,
      row,
      parent,
      mentions.map((mention) => mention.userId),
    );
    this.events.emitToCommentsThread(targetType, targetId, "comment-changed");

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

    // "comment" is one of the onboarding checklist's steps (OnboardingService).
    this.events.emitToUser(authorId, "onboarding-updated");

    const [[reactionMap, myReactionMap], xpMap] = await Promise.all([
      this.loadReactions(authorId, [row.id]),
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
    if (existing.authorId !== authorId)
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.CommentForbidden);

    const spoilerTag =
      existing.targetType === "MUSIC" ? false : !!body.spoilerTag;
    const mentions = await this.resolveMentions(
      authorId,
      existing.targetType as CommentTargetType,
      existing.targetId,
      body.text,
      body.mentions,
    );

    const row = await this.prisma.comment.update({
      where: { id },
      data: {
        text: body.text,
        spoilerTag,
        edited: true,
        mentions: {
          deleteMany: {},
          create: mentions,
        },
      },
      include: {
        author: { select: AUTHOR_SELECT },
        mentions: { select: MENTION_SELECT },
      },
    });
    this.events.emitToCommentsThread(
      existing.targetType,
      existing.targetId,
      "comment-changed",
    );

    const [[reactionMap, myReactionMap], xpMap] = await Promise.all([
      this.loadReactions(authorId, [row.id]),
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
    this.events.emitToCommentsThread(
      existing.targetType,
      existing.targetId,
      "comment-changed",
    );
  }

  /**
   * Admin takedown (moderation): same tombstone, no ownership check. Returns
   * the pre-tombstone author/text so the caller can build the DSA art. 17
   * notice (and keep an evidence snapshot) before the public text is nulled.
   */
  async adminRemove(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    authorId: string | null;
    text: string | null;
    targetType: string;
    targetId: string;
  }> {
    const db = tx ?? this.prisma;
    const existing = await db.comment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);

    await this.softDelete(id, true, tx);

    if (tx) {
      await this.xp.revokeBySource("Comment", [id], tx);
    } else {
      await this.xp.revokeBySource("Comment", [id]);
    }

    if (!tx) this.publishAdminRemoval(existing.targetType, existing.targetId);
    return {
      authorId: existing.authorId,
      text: existing.text,
      targetType: existing.targetType,
      targetId: existing.targetId,
    };
  }

  publishAdminRemoval(targetType: string, targetId: string): void {
    this.events.emitToCommentsThread(targetType, targetId, "comment-changed");
  }

  private async softDelete(
    id: string,
    byAdmin: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).comment.update({
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
      select: {
        id: true,
        deletedAt: true,
        authorId: true,
        targetType: true,
        targetId: true,
      },
    });
    if (!comment || comment.deletedAt)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);

    await this.ensureParticipationAllowed(
      userId,
      comment.targetType as CommentTargetType,
      comment.targetId,
    );

    if (comment.authorId) {
      await this.ensureInteractionNotBlocked(userId, comment.authorId);
    }

    const reaction = await this.prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: { emote },
      create: { commentId, userId, emote },
    });
    this.events.emitToCommentsThread(
      comment.targetType,
      comment.targetId,
      "comment-changed",
    );

    // Credited to the comment's author, never the reactor — and never at all
    // when they are one and the same, mirroring ReviewVote's self-vote
    // exclusion. No UP/DOWN distinction here (unlike ReviewVote).
    if (comment.authorId && comment.authorId !== userId) {
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
    // work with afterwards, and so the comment's target is known to notify
    // its thread even once the reaction row is gone.
    const existing = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: {
        id: true,
        comment: { select: { targetType: true, targetId: true } },
      },
    });

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        deletedAt: true,
        targetType: true,
        targetId: true,
        authorId: true,
      },
    });
    if (!comment || comment.deletedAt)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);
    await this.ensureParticipationAllowed(
      userId,
      comment.targetType as CommentTargetType,
      comment.targetId,
    );

    if (comment.authorId) {
      await this.ensureInteractionNotBlocked(userId, comment.authorId);
    }

    await this.prisma.commentReaction.deleteMany({
      where: { commentId, userId },
    });

    if (existing) {
      await this.xp.revokeBySource("CommentReaction", [existing.id]);
      this.events.emitToCommentsThread(
        existing.comment.targetType,
        existing.comment.targetId,
        "comment-changed",
      );
    }
  }

  /** A discussion is readable to everyone, but only a tracker can join it. */
  private async ensureParticipationAllowed(
    userId: string,
    targetType: CommentTargetType,
    targetId: string,
  ): Promise<void> {
    let entry: unknown = null;

    switch (targetType) {
      case "MEDIA":
        entry = await this.prisma.libraryEntry.findUnique({
          where: { userId_mediaItemId: { userId, mediaItemId: targetId } },
          select: { id: true },
        });
        break;
      case "GAME":
        entry = await this.prisma.gameEntry.findUnique({
          where: { userId_gameItemId: { userId, gameItemId: targetId } },
          select: { id: true },
        });
        break;
      case "BOOK":
        entry = await this.prisma.bookEntry.findUnique({
          where: { userId_bookItemId: { userId, bookItemId: targetId } },
          select: { id: true },
        });
        break;
      case "MUSIC":
        entry = await this.prisma.musicEntry.findUnique({
          where: { userId_musicItemId: { userId, musicItemId: targetId } },
          select: { id: true },
        });
        break;

      case "SEASON": {
        const season = await this.prisma.season.findUnique({
          where: { id: targetId },
          select: { mediaItemId: true },
        });

        if (season) {
          entry = await this.prisma.libraryEntry.findUnique({
            where: {
              userId_mediaItemId: { userId, mediaItemId: season.mediaItemId },
            },
            select: { id: true },
          });
        }

        break;
      }

      case "EPISODE": {
        const episode = await this.prisma.episode.findUnique({
          where: { id: targetId },
          select: { season: { select: { mediaItemId: true } } },
        });

        if (episode) {
          entry = await this.prisma.libraryEntry.findUnique({
            where: {
              userId_mediaItemId: {
                userId,
                mediaItemId: episode.season.mediaItemId,
              },
            },
            select: { id: true },
          });
        }

        break;
      }
    }

    if (!entry) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.CommentParticipationRequiresLibrary,
      );
    }
  }

  private async ensureInteractionNotBlocked(
    actorId: string,
    otherUserId: string,
  ): Promise<void> {
    if (
      actorId !== otherUserId &&
      (await this.blocks.isBlockedEitherWay(actorId, otherUserId))
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.CommentInteractionBlocked,
      );
    }
  }

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
            anonymizeAuthor(
              toUserSummaryDto(row.author),
              viewerId,
              row.targetType,
              row.targetId,
            ),
            viewerId,
            xpMap,
            isGamificationEnabled(this.config, this.flags),
            hideProgressionByUser,
          )
        : null,
      mentions: (row.mentions ?? []).flatMap((mention): CommentMentionDto[] =>
        mention.user
          ? [
              {
                id: mention.user.id,
                username: mention.user.username,
                start: mention.start,
              },
            ]
          : [],
      ),
      reactions: reactionMap.get(row.id) ?? [],
      myReaction: myReactionMap.get(row.id) ?? null,
      // Both filled in by `list`, which is the only reader that has them.
      replies: [],
      replyCount: 0,
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
    mentionedUserIds: string[],
  ): Promise<void> {
    const notifiedIds = new Set<string>([authorId]);

    if (parent?.authorId && !notifiedIds.has(parent.authorId)) {
      if (await this.mayNotify(authorId, parent.authorId)) {
        await this.notify(parent.authorId, row, NotificationType.COMMENT_REPLY);
        notifiedIds.add(parent.authorId);
      }
    }

    for (const userId of mentionedUserIds) {
      if (notifiedIds.has(userId)) continue;

      if (await this.mayNotify(authorId, userId)) {
        await this.notify(userId, row, NotificationType.COMMENT_MENTION);
        notifiedIds.add(userId);
      }
    }
  }

  /**
   * Mentions are deliberate picker choices, not a parser for arbitrary text.
   * A recipient must still be a visible discussion participant when the
   * comment is submitted, which also neutralizes stale picker results.
   */
  private async resolveMentions(
    authorId: string,
    targetType: CommentTargetType,
    targetId: string,
    text: string,
    requestedMentions?: CommentMentionInputDto[],
  ): Promise<CommentMentionInputDto[]> {
    const requested = (requestedMentions ?? [])
      .slice(0, 5)
      .filter(
        (mention, index, all) =>
          mention.userId !== authorId &&
          all.findIndex((candidate) => candidate.start === mention.start) ===
            index,
      );
    if (requested.length === 0) return [];
    const ids = [...new Set(requested.map((mention) => mention.userId))];

    const candidates = await this.prisma.comment.findMany({
      where: {
        targetType,
        targetId,
        deletedAt: null,
        authorId: { in: ids },
      },
      distinct: ["authorId"],
      select: { authorId: true, author: { select: AUTHOR_SELECT } },
    });
    const byId = new Map(
      candidates
        .filter((candidate) => candidate.authorId && candidate.author)
        .map((candidate) => [candidate.authorId!, candidate.author!]),
    );
    const resolved: CommentMentionInputDto[] = [];

    for (const mention of requested) {
      const user = byId.get(mention.userId);
      if (!user || user.profileAccess === ProfileAccess.GHOST) continue;

      if (!this.textContainsMentionAt(text, user.username, mention.start)) {
        continue;
      }

      const relation = await this.visibility.getRelation(authorId, {
        id: user.id,
        profileAccess: user.profileAccess,
      });
      if (!relation.blocking && !relation.blockedByTarget)
        resolved.push(mention);
    }

    return resolved;
  }

  private textContainsMentionAt(
    text: string,
    username: string,
    start: number,
  ): boolean {
    const token = `@${username}`;

    if (
      text.slice(start, start + token.length).toLowerCase() !==
      token.toLowerCase()
    ) {
      return false;
    }

    const before = start === 0 ? "" : text[start - 1];
    const after = text[start + token.length] ?? "";
    return !/[\w.@]/.test(before) && !/\w/.test(after);
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
      url: url
        ? `${url}?comment=${row.id}&commentTarget=${row.targetType}:${row.targetId}`
        : null,
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
      url: url
        ? `${url}?comment=${commentId}&commentTarget=${comment.targetType}:${comment.targetId}`
        : null,
      dedupeKey: `reactions:${commentId}:${COMMENT_REACTION_NOTIFY_THRESHOLD}`,
    });
  }
}
