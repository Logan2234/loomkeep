import type { Emote } from "@loomkeep/shared/enums";
import type { DataExportCommentReaction } from "../../../account/data-export.types";

export class DataExportCommentReactionResponseDto implements DataExportCommentReaction {
  /**
   * The comment reacted to.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  commentId!: string;

  /**
   * The reaction.
   * @example "LOVE"
   */
  emote!: Emote;

  /**
   * When it was added.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
