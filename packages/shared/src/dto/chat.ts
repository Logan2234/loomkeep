import type { CommentEmote } from "../enums";
import type { CommentReactionSummaryDto } from "./comment";
import type { UserSummaryDto } from "./social";

/** Max length of a message's text (frontend + backend DTO). */
export const MESSAGE_TEXT_MAX_LENGTH = 2000;

/**
 * Why a conversation stays readable but can't be written to anymore:
 * - `unfollowed`: the two members no longer follow each other;
 * - `blocked`: the viewer blocked the other member (who, blocked, no longer
 *   sees the conversation at all);
 * - `deleted`: the other member's account is gone, with its messages' text.
 */
export type ConversationReadOnlyReason = "unfollowed" | "blocked" | "deleted";

export interface MessageDto {
  id: string;
  conversationId: string;
  /** Null once the author's account is deleted. */
  authorId: string | null;
  /** Written by the viewer. */
  mine: boolean;
  /** Restricted markdown, rendered by the web. Null once deleted. */
  text: string | null;
  /** Sent with `/spoiler`: the whole message stays masked until revealed. */
  spoiler: boolean;
  edited: boolean;
  deleted: boolean;
  /** Taken down by moderation rather than by its author. */
  deletedByAdmin: boolean;
  reactions: CommentReactionSummaryDto[];
  myReaction: CommentEmote | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDto {
  id: string;
  /** The other member; null once their account is deleted. */
  peer: UserSummaryDto | null;
  readOnly: ConversationReadOnlyReason | null;
  /**
   * Whether the other member has the app open. Null when either of the two
   * hides their presence: the setting is reciprocal.
   */
  peerOnline: boolean | null;
  /**
   * Up to when the other member has read, for the "Vu" under the viewer's
   * last message. Null when either of the two hides read receipts.
   */
  peerLastReadAt: string | null;
  lastMessage: MessageDto | null;
  /** Messages from the other member sent after the viewer last read. */
  unread: number;
  muted: boolean;
  lastMessageAt: string;
}

/** `GET /chat/unread`: what the Messages launcher shows. Muted conversations don't count. */
export interface ChatUnreadDto {
  count: number;
}

export interface OpenConversationRequestDto {
  username: string;
}

export interface SendMessageRequestDto {
  text: string;
  spoiler?: boolean;
}

export type EditMessageRequestDto = SendMessageRequestDto;

export interface ReactMessageRequestDto {
  emote: CommentEmote;
}

export interface MuteConversationRequestDto {
  muted: boolean;
}
