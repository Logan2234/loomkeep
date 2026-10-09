import type {
  ChatUnreadDto,
  CommentEmote,
  ConversationDto,
  ConversationReadOnlyReason,
  MessageDto,
  MessageWorkDto,
  MessageWorkKind,
  RecommendWorkResultDto,
} from "@loomkeep/shared";
import { CommentReactionSummaryResponseDto } from "../../comments/dto/comment-reaction-summary-response.dto";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";

export class MessageWorkResponseDto implements MessageWorkDto {
  kind!: MessageWorkKind;
  title!: string;
  imageUrl!: string | null;
  href!: string;
  year!: number | null;
  inLibrary!: boolean;
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
  muted!: boolean;
  lastMessageAt!: string;
}

export class ChatUnreadResponseDto implements ChatUnreadDto {
  count!: number;
}

export class RecommendWorkResultResponseDto implements RecommendWorkResultDto {
  sent!: number;
}
