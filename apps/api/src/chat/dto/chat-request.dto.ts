import {
  CommentEmote,
  type CommentEmote as CommentEmoteT,
  type EditMessageRequestDto,
  type ForwardMessageRequestDto,
  MESSAGE_TEXT_MAX_LENGTH,
  type MarkWorkUnreadRequestDto,
  type MuteConversationRequestDto,
  type OpenConversationRequestDto,
  RECOMMEND_MAX_FRIENDS,
  type ReactMessageRequestDto,
  type RecommendWorkRequestDto,
  type SendMessageRequestDto,
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

export class OpenConversationBody implements OpenConversationRequestDto {
  @IsString()
  @MinLength(1)
  username!: string;
}

export class EditMessageBody implements EditMessageRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  @Matches(/\S/)
  text!: string;

  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  skipLinks?: string[];
}

/** The text may be left out when a work goes with it. */
export class SendMessageBody implements SendMessageRequestDto {
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
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  skipLinks?: string[];
}

export class RecommendWorkBody implements RecommendWorkRequestDto {
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

export class ForwardMessageBody implements ForwardMessageRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RECOMMEND_MAX_FRIENDS)
  @ArrayUnique()
  @IsString({ each: true })
  usernames!: string[];
}

export class ReactMessageBody implements ReactMessageRequestDto {
  @IsIn(Object.values(CommentEmote))
  emote!: CommentEmoteT;
}

export class MarkWorkUnreadBody implements MarkWorkUnreadRequestDto {
  @IsString()
  commentId!: string;
}

export class MuteConversationBody implements MuteConversationRequestDto {
  @IsBoolean()
  muted!: boolean;
}
