import type { CommentMentionInputDto } from "@loomkeep/shared";
import { Type } from "class-transformer";
import { IsInt, IsString, Min } from "class-validator";

export class CommentMentionBody implements CommentMentionInputDto {
  @IsString()
  userId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  start!: number;
}
