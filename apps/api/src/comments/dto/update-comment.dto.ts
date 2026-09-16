import { COMMENT_TEXT_MAX_LENGTH } from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CommentMentionBody } from "./comment-mention.dto";

export class UpdateCommentBody {
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
