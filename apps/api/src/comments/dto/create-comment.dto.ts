import {
  COMMENT_TEXT_MAX_LENGTH,
  CommentTargetType,
  type CommentTargetType as CommentTargetTypeT,
} from "@loomkeep/shared";
import {
  IsBoolean,
  IsIn,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateCommentBody {
  @IsIn(Object.values(CommentTargetType))
  targetType!: CommentTargetTypeT;

  @IsString()
  targetId!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_TEXT_MAX_LENGTH)
  @Matches(/\S/)
  text!: string;

  @IsOptional()
  @IsBoolean()
  spoilerTag?: boolean;
}
