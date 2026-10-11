import type {
  ChatUnreadDto,
  CommentEmote,
  CommentTargetType,
  ConversationDto,
  ConversationReadOnlyReason,
  ConversationWorkDto,
  ListKind,
  ListVisibility,
  MessageDto,
  MessageGoneAttachment,
  MessageListDto,
  MessageListWorkDto,
  MessagePickDto,
  MessagePollDto,
  MessagePollOptionDto,
  MessageReviewDto,
  MessageSagaDto,
  MessageSagaRefDto,
  MessageWhereDto,
  MessageWorkDto,
  MessageWorkKind,
  PickDomain,
  PickResultDto,
  RecommendWorkResultDto,
  SagaDomain,
  SagaStep,
  WatchOfferKind,
  WorkThreadDto,
} from "@loomkeep/shared";
import { CommentReactionSummaryResponseDto } from "../../comments/dto/comment-reaction-summary-response.dto";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";
import { ReviewTargetSummaryResponseDto } from "../../reviews/dto/review-target-summary-response.dto";

export class MessageWorkResponseDto implements MessageWorkDto {
  kind!: MessageWorkKind;
  title!: string;
  imageUrl!: string | null;
  href!: string;
  year!: number | null;
  inLibrary!: boolean;
}

export class ConversationWorkResponseDto
  extends MessageWorkResponseDto
  implements ConversationWorkDto
{
  messageId!: string;
  sharedAt!: string;
  mine!: boolean;
}

export class MessageReviewResponseDto implements MessageReviewDto {
  id!: string;
  rating!: number;
  text!: string | null;
  spoiler!: boolean;
  target!: ReviewTargetSummaryResponseDto | null;
}

class MessageListWorkResponseDto implements MessageListWorkDto {
  title!: string;
  imageUrl!: string | null;
}

export class MessageListResponseDto implements MessageListDto {
  id!: string;
  title!: string;
  kind!: ListKind;
  visibility!: ListVisibility;
  itemCount!: number;
  works!: MessageListWorkResponseDto[];
  ownerName!: string;
  mine!: boolean;
  updatedAt!: string;
}

class MessagePollOptionResponseDto implements MessagePollOptionDto {
  id!: string;
  text!: string;
  href!: string | null;
  imageUrl!: string | null;
  voters!: UserSummaryResponseDto[];
}

class MessagePollResponseDto implements MessagePollDto {
  question!: string;
  options!: MessagePollOptionResponseDto[];
  myVote!: string | null;
}

class MessageSagaRefResponseDto implements MessageSagaRefDto {
  domain!: SagaDomain;
  key!: string;
}

class MessagePickResponseDto implements MessagePickDto {
  domain!: PickDomain;
  shared!: boolean;
  count!: number;
}

export class PickResultResponseDto implements PickResultDto {
  work!: MessageWorkResponseDto | null;
  mine!: number;
  shared!: number;
}

class MessageSagaWorkResponseDto {
  title!: string;
  imageUrl!: string | null;
  href!: string | null;
  upcoming!: boolean;
}

class MessageSagaMemberResponseDto {
  user!: UserSummaryResponseDto;
  mine!: boolean;
  steps!: SagaStep[];
}

export class MessageSagaResponseDto implements MessageSagaDto {
  domain!: SagaDomain;
  title!: string;
  works!: MessageSagaWorkResponseDto[];
  members!: MessageSagaMemberResponseDto[];
}

class WatchOfferProviderResponseDto {
  id!: number;
  name!: string;
  logoUrl!: string | null;
}

class MessageWhereOfferResponseDto {
  provider!: WatchOfferProviderResponseDto;
  kind!: WatchOfferKind;
  members!: UserSummaryResponseDto[];
}

export class MessageWhereResponseDto implements MessageWhereDto {
  region!: string;
  offers!: MessageWhereOfferResponseDto[];
  link!: string | null;
}

export class MessageResponseDto implements MessageDto {
  id!: string;
  conversationId!: string;
  authorId!: string | null;
  mine!: boolean;
  text!: string | null;
  spoiler!: boolean;
  edited!: boolean;
  deleted!: boolean;
  deletedByAdmin!: boolean;
  reactions!: CommentReactionSummaryResponseDto[];
  myReaction!: CommentEmote | null;
  works!: MessageWorkResponseDto[];
  review!: MessageReviewResponseDto | null;
  list!: MessageListResponseDto | null;
  gone!: MessageGoneAttachment | null;
  poll!: MessagePollResponseDto | null;
  saga!: MessageSagaRefResponseDto | null;
  pick!: MessagePickResponseDto | null;
  where!: boolean;
  pinned!: boolean;
  forwarded!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class ConversationResponseDto implements ConversationDto {
  id!: string;
  peer!: UserSummaryResponseDto | null;
  readOnly!: ConversationReadOnlyReason | null;
  peerOnline!: boolean | null;
  peerLastReadAt!: string | null;
  lastMessage!: MessageResponseDto | null;
  unread!: number;
  lastReadAt!: string;
  muted!: boolean;
  lastMessageAt!: string;
}

export class ChatUnreadResponseDto implements ChatUnreadDto {
  count!: number;
  works!: number;
}

class WorkThreadLastCommentResponseDto {
  authorName!: string | null;
  mine!: boolean;
  text!: string | null;
}

export class WorkThreadResponseDto implements WorkThreadDto {
  targetType!: CommentTargetType;
  targetId!: string;
  title!: string;
  kind!: MessageWorkKind | null;
  seasonNumber!: number | null;
  episodeNumber!: number | null;
  imageUrl!: string | null;
  href!: string | null;
  unread!: number;
  lastReadAt!: string | null;
  muted!: boolean;
  canParticipate!: boolean;
  lastActivityAt!: string;
  lastComment!: WorkThreadLastCommentResponseDto | null;
}

export class RecommendWorkResultResponseDto implements RecommendWorkResultDto {
  sent!: number;
}
