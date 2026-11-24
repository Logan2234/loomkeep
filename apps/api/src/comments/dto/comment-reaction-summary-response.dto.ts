import type { CommentReactionSummaryDto, Emote } from "@loomkeep/shared";

export class CommentReactionSummaryResponseDto implements CommentReactionSummaryDto {
  emote!: Emote;
  count!: number;
}
