import {
  CommentEmote,
  type CommentEmote as CommentEmoteT,
  MESSAGE_TEXT_MAX_LENGTH,
  RECOMMEND_MAX_FRIENDS,
} from "@loomkeep/shared";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

// A work page's path, the way the web links to it.
const WORK_PATH =
  /^\/app\/(media\/(movie|series|anime)|games|books|music)\/[^/?#\s]+$/;

export class OpenConversationBody {
  @IsString()
  @MinLength(1)
  username!: string;
}

export class EditMessageBody {
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  @Matches(/\S/)
  text!: string;

  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;

  @IsOptional()
  @IsBoolean()
  linkCards?: boolean;
}

/** The text may be left out when a work goes with it. */
export class SendMessageBody {
  @ValidateIf((body: SendMessageBody) => !body.work || body.text !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  @Matches(/\S/)
  text?: string;

  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;

  @IsOptional()
  @IsString()
  @Matches(WORK_PATH)
  work?: string;

  @IsOptional()
  @IsBoolean()
  linkCards?: boolean;
}

export class RecommendWorkBody {
  @IsString()
  @Matches(WORK_PATH)
  work!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RECOMMEND_MAX_FRIENDS)
  @ArrayUnique()
  @IsString({ each: true })
  usernames!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  text?: string;
}

export class ReactMessageBody {
  @IsIn(Object.values(CommentEmote))
  emote!: CommentEmoteT;
}

export class MuteConversationBody {
  @IsBoolean()
  muted!: boolean;
}
