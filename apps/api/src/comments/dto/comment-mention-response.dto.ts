import type { CommentMentionDto } from "@loomkeep/shared";

export class CommentMentionResponseDto implements CommentMentionDto {
  id!: string;
  username!: string;
  start!: number;
}
