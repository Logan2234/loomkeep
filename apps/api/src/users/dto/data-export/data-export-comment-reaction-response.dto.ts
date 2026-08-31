import type { CommentEmote, DataExportCommentReaction } from "@loomkeep/shared";

export class DataExportCommentReactionResponseDto implements DataExportCommentReaction {
  commentId!: string;
  emote!: CommentEmote;
  createdAt!: string;
}
