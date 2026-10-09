import {
  CommentEmote,
  type CommentEmote as CommentEmoteT,
  MESSAGE_TEXT_MAX_LENGTH,
  type MuteConversationRequestDto,
  type OpenConversationRequestDto,
  type ReactMessageRequestDto,
  type SendMessageRequestDto,
} from "@loomkeep/shared";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class OpenConversationBody implements OpenConversationRequestDto {
  @IsString()
  @MinLength(1)
  username!: string;
}

export class SendMessageBody implements SendMessageRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  @Matches(/\S/)
  text!: string;

  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;
}

export class ReactMessageBody implements ReactMessageRequestDto {
  @IsIn(Object.values(CommentEmote))
  emote!: CommentEmoteT;
}

export class MuteConversationBody implements MuteConversationRequestDto {
  @IsBoolean()
  muted!: boolean;
}
