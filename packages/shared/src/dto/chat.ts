import type { CommentEmote, CommentTargetType, MediaType } from "../enums";
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

/** Labels a work card: a media's own type, otherwise its domain. */
export type MessageWorkKind = MediaType | "GAME" | "BOOK" | "MUSIC";

/** A work card in a message, as it was when the message was sent. */
export interface MessageWorkDto {
  kind: MessageWorkKind;
  title: string;
  imageUrl: string | null;
  /** Client route to the work's page. */
  href: string;
  year: number | null;
  /** The viewer already tracks the work: the card offers no "Add". */
  inLibrary: boolean;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  /** Null once the author's account is deleted. */
  authorId: string | null;
  /** Written by the viewer. */
  mine: boolean;
  /**
   * Restricted markdown, rendered by the web. Null once deleted, and for a
   * message that only carries a work.
   */
  text: string | null;
  /** Sent with `/spoiler`: the whole message stays masked until revealed. */
  spoiler: boolean;
  edited: boolean;
  deleted: boolean;
  /** Taken down by moderation rather than by its author. */
  deletedByAdmin: boolean;
  reactions: CommentReactionSummaryDto[];
  myReaction: CommentEmote | null;
  /** The attached work first, then the work links found in the text. */
  works: MessageWorkDto[];
  /** Pinned in the conversation, by either member. */
  pinned: boolean;
  /** Copied from another conversation by "Transférer". */
  forwarded: boolean;
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
  /** Up to when the viewer has read: where the "new" line goes. */
  lastReadAt: string;
  muted: boolean;
  lastMessageAt: string;
}

/** `GET /chat/unread`: what the Messages launcher shows. Muted conversations don't count. */
export interface ChatUnreadDto {
  count: number;
  /** Unread in the works' discussions of the "Œuvres" tab. */
  works: number;
}

/**
 * A work's discussion in Messages' "Œuvres" tab: one the viewer wrote in or
 * was mentioned in. The comments themselves keep their own API.
 */
export interface WorkThreadDto {
  targetType: CommentTargetType;
  targetId: string;
  /** The work's title; a season or an episode adds its numbers. */
  title: string;
  kind: MessageWorkKind | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  imageUrl: string | null;
  /** The work's page: a season's or an episode's leads to its series. */
  href: string | null;
  unread: number;
  /** Writing needs the work in the library (comments' own rule). */
  canParticipate: boolean;
  lastActivityAt: string;
  lastComment: {
    authorName: string | null;
    mine: boolean;
    /** Null for a comment tagged as a spoiler. */
    text: string | null;
  } | null;
}

export interface OpenConversationRequestDto {
  username: string;
}

export interface SendMessageRequestDto {
  /** Optional when a work is attached. */
  text?: string;
  spoiler?: boolean;
  /** A work page's path (`/app/games/1942`), attached to the message as a card. */
  work?: string;
  /** Links whose card the writer turned down: they stay plain links. */
  skipLinks?: string[];
}

export interface EditMessageRequestDto {
  text: string;
  spoiler?: boolean;
  skipLinks?: string[];
}

/** "Recommander": the work goes to each friend in their own conversation. */
export interface RecommendWorkRequestDto {
  /** The work page's path, as for `SendMessageRequestDto.work`. */
  work: string;
  usernames: string[];
  text?: string;
}

/** A work shared in a conversation, for its gallery: the latest card of it. */
export interface ConversationWorkDto extends MessageWorkDto {
  messageId: string;
  sharedAt: string;
  /** Shared by the viewer. */
  mine: boolean;
}

/** Shortest query `GET /chat/conversations/:id/search` looks for. */
export const CHAT_SEARCH_MIN_LENGTH = 2;

/** Pins a conversation keeps, at most. */
export const PINNED_MESSAGES_MAX = 50;

/** "Transférer": a copy of the message goes to each friend picked. */
export interface ForwardMessageRequestDto {
  usernames: string[];
}

/** Max friends one recommendation goes to. */
export const RECOMMEND_MAX_FRIENDS = 20;

export interface RecommendWorkResultDto {
  sent: number;
}

export interface ReactMessageRequestDto {
  emote: CommentEmote;
}

export interface MuteConversationRequestDto {
  muted: boolean;
}
