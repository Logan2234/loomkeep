import { COMMENT_TEXT_MAX_LENGTH } from "@loomkeep/shared";
import {
  IsBoolean,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateCommentBody {
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_TEXT_MAX_LENGTH)
  @Matches(/\S/)
  text!: string;

  @IsOptional()
  @IsBoolean()
  spoilerTag?: boolean;
}
