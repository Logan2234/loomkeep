import { Type } from "class-transformer";
import { IsInt, IsString, Min } from "class-validator";

export class CommentMentionBody {
  @IsString()
  userId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  start!: number;
}
