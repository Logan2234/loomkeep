import type { CommentMentionDto } from "@loomkeep/shared/contracts";

export class CommentMentionResponseDto implements CommentMentionDto {
  id!: string;
  username!: string;
  start!: number;
}
