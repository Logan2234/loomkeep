import type { CommentEmote, CommentReactionSummaryDto } from "@loomkeep/shared";

export class CommentReactionSummaryResponseDto implements CommentReactionSummaryDto {
  emote!: CommentEmote;
  count!: number;
}
