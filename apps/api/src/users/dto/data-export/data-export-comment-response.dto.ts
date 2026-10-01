import type { CommentTargetType, DataExportComment } from "@loomkeep/shared";

export class DataExportCommentResponseDto implements DataExportComment {
  /**
   * What the comment is under: a work, a season, an episode…
   * @example "EPISODE"
   */
  targetType!: CommentTargetType;

  /**
   * Its id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  targetId!: string;

  /**
   * The comment it answers, if any.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  parentId!: string | null;

  /**
   * The comment's text; null once deleted.
   * @example "That ending!"
   */
  text!: string | null;

  /**
   * Marked as a spoiler.
   * @example true
   */
  spoilerTag!: boolean;

  /**
   * Edited after posting.
   * @example false
   */
  edited!: boolean;

  /**
   * When it was deleted, if it was.
   * @example "2026-10-01T08:00:00.000Z"
   */
  deletedAt!: string | null;

  /**
   * When it was posted.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;

  /**
   * When it last changed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  updatedAt!: string;
}
