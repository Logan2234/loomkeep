import { COMMENT_TEXT_MAX_LENGTH } from "@loomkeep/shared";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateCommentBody {
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_TEXT_MAX_LENGTH)
  text!: string;

  @IsOptional()
  @IsBoolean()
  spoilerTag?: boolean;
}
