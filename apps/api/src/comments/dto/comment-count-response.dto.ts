import type { CommentCountDto } from "@loomkeep/shared/contracts";

export class CommentCountResponseDto implements CommentCountDto {
  count!: number;
}
