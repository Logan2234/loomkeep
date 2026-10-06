import {
  CommentEmote,
  type CommentEmote as CommentEmoteT,
  MESSAGE_TEXT_MAX_LENGTH,
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

export class OpenConversationBody {
  @IsString()
  @MinLength(1)
  username!: string;
}

export class SendMessageBody {
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  @Matches(/\S/)
  text!: string;

  @IsOptional()
  @IsBoolean()
  spoiler?: boolean;
}

export class ReactMessageBody {
  @IsIn(Object.values(CommentEmote))
  emote!: CommentEmoteT;
}

export class MuteConversationBody {
  @IsBoolean()
  muted!: boolean;
}
