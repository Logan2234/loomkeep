import type { CommentReactionSummaryDto } from "@loomkeep/shared/contracts";
import type { Emote } from "@loomkeep/shared/enums";

export class CommentReactionSummaryResponseDto implements CommentReactionSummaryDto {
  emote!: Emote;
  count!: number;
}
