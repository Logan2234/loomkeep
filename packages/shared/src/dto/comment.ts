import type { CommentEmote, CommentTargetType } from "../enums";
import type { UserSummaryDto } from "./social";

/** Reaction counts on a comment, one entry per emote actually used. */
export interface CommentReactionSummaryDto {
  emote: CommentEmote;
  count: number;
}

/** A comment or one of its (single-level) replies. */
export interface CommentDto {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  /** Null for a top-level comment, the parent's id for a reply. */
  parentId: string | null;
  /** Null once deleted — the client renders a tombstone instead. */
  text: string | null;
  deleted: boolean;
  /** Whether the tombstone came from an admin takedown rather than the author. */
  deletedByAdmin: boolean;
  edited: boolean;
  /** Raw author-set tag, for prefilling the edit form. */
  spoilerTag: boolean;
  /**
   * Whether this comment should render blurred for the viewer right now —
   * purely `spoilerTag` (MUSIC is always false). Recomputed per read, never
   * stored.
   */
  masked: boolean;
  createdAt: string;
  updatedAt: string;
  /** Null once the author's account has been deleted — content stays, identity doesn't. */
  author: UserSummaryDto | null;
  reactions: CommentReactionSummaryDto[];
  /** The viewer's own active reaction, or null. */
  myReaction: CommentEmote | null;
  /** Only populated on top-level comments. */
  replies: CommentDto[];
}

/** Total comment count (top-level + replies) for a target, for a collapsed toggle badge. */
export interface CommentCountDto {
  count: number;
}

export interface CreateCommentDto {
  targetType: CommentTargetType;
  targetId: string;
  parentId?: string;
  text: string;
  spoilerTag?: boolean;
}

export interface UpdateCommentDto {
  text: string;
  spoilerTag?: boolean;
}

/** One comment authored by a user, for the admin user drawer's "Commentaires" shortcut. */
export interface AdminUserCommentDto {
  id: string;
  excerpt: string;
  href: string | null;
  createdAt: string;
}
