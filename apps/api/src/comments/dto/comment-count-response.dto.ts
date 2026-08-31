import type { CommentCountDto } from "@loomkeep/shared";

export class CommentCountResponseDto implements CommentCountDto {
  count!: number;
}
