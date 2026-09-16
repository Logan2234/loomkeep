import {
  COMMENT_TEXT_MAX_LENGTH,
  CommentTargetType,
  type CommentTargetType as CommentTargetTypeT,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CommentMentionBody } from "./comment-mention.dto";

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique((mention: CommentMentionBody) => mention.start)
  @ValidateNested({ each: true })
  @Type(() => CommentMentionBody)
  mentions?: CommentMentionBody[];
}
