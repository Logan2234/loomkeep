import {
  CommentEmote,
  MESSAGE_TEXT_MAX_LENGTH,
  POLL_OPTION_MAX_LENGTH,
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  POLL_QUESTION_MAX_LENGTH,
  RECOMMEND_MAX_FRIENDS,
  type CommentEmote as CommentEmoteT,
  type EditMessageRequestDto,
  type ForwardMessageRequestDto,
  type MarkWorkUnreadRequestDto,
  type MessageSagaRefDto,
  type MuteConversationRequestDto,
  type OpenConversationRequestDto,
  type PickDomain,
  type PickRequestDto,
  type ReactMessageRequestDto,
  type RecommendWorkRequestDto,
  type SagaDomain,
  type SendMessageRequestDto,
  type SendPickRequestDto,
  type SendPollRequestDto,
  type VotePollRequestDto,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
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
  ValidateNested,
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

const SAGA_DOMAINS: SagaDomain[] = ["MEDIA", "GAMES", "BOOKS"];
const PICK_DOMAINS: PickDomain[] = ["MEDIA", "GAMES", "BOOKS", "MUSIC"];

/** An option is text, or a work by its page's path. */
export class PollOptionBody {
  @ValidateIf((option: PollOptionBody) => !option.work)
  @IsString()
  @Matches(/\S/)
  @MaxLength(POLL_OPTION_MAX_LENGTH)
  text?: string;

  @IsOptional()
  @IsString()
  @Matches(WORK_PATH)
  work?: string;
}

export class SendPollBody implements SendPollRequestDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(POLL_QUESTION_MAX_LENGTH)
  question!: string;

  @IsArray()
  @ArrayMinSize(POLL_OPTIONS_MIN)
  @ArrayMaxSize(POLL_OPTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => PollOptionBody)
  options!: PollOptionBody[];
}

export class SagaRefBody implements MessageSagaRefDto {
  @IsIn(SAGA_DOMAINS)
  domain!: SagaDomain;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key!: string;
}

export class PickBody implements PickRequestDto {
  @IsIn(PICK_DOMAINS)
  domain!: PickDomain;

  @IsBoolean()
  shared!: boolean;
}

export class SendPickBody extends PickBody implements SendPickRequestDto {
  @IsString()
  @Matches(WORK_PATH)
  work!: string;
}

export class VotePollBody implements VotePollRequestDto {
  @IsString()
  @MinLength(1)
  option!: string;
}

/** The text may be left out when something else goes with it. */
export class SendMessageBody implements SendMessageRequestDto {
  @ValidateIf(
    (body: SendMessageBody) =>
      !(
        body.work ||
        body.review ||
        body.list ||
        body.poll ||
        body.saga ||
        body.pick ||
        body.where
      ) || body.text !== undefined,
  )
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
  @IsString()
  @MinLength(1)
  review?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  list?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendPollBody)
  poll?: SendPollBody;

  @IsOptional()
  @ValidateNested()
  @Type(() => SagaRefBody)
  saga?: SagaRefBody;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendPickBody)
  pick?: SendPickBody;

  @IsOptional()
  @IsString()
  @Matches(WORK_PATH)
  where?: string;

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
