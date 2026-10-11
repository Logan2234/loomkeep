import type {
  CommentEmote,
  CommentTargetType,
  Domain,
  ListKind,
  ListVisibility,
  MediaType,
} from "../enums";
import type { WatchProviderDto } from "./catalog";
import type { CommentReactionSummaryDto } from "./comment";
import type { ReviewTargetSummaryDto } from "./review";
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

/** A review attached with `/review`: always its author's, read as it is now. */
export interface MessageReviewDto {
  /** Anchors "Lire la critique entière" on the work's page (`#review-<id>`). */
  id: string;
  rating: number;
  text: string | null;
  /** Tagged as a spoiler by its author: the card hides its text until revealed. */
  spoiler: boolean;
  /** The reviewed work; a season or an episode adds its numbers. */
  target: ReviewTargetSummaryDto | null;
}

/** A work on a list's card. */
export interface MessageListWorkDto {
  title: string;
  imageUrl: string | null;
}

/** Works a list's card shows, at most. */
export const MESSAGE_LIST_WORKS = 5;

/** A list attached with `/list`, read as it is now. */
export interface MessageListDto {
  id: string;
  title: string;
  kind: ListKind;
  visibility: ListVisibility;
  itemCount: number;
  /** Its first works, in the list's order (`MESSAGE_LIST_WORKS` at most). */
  works: MessageListWorkDto[];
  /** The list's owner. */
  ownerName: string;
  /** The list is the viewer's own. */
  mine: boolean;
  updatedAt: string;
}

/**
 * What a message carried and can't show anymore: a review deleted since, or a
 * list deleted or no longer visible to the viewer.
 */
export type MessageGoneAttachment = "review" | "list";

/** Options a `/poll` has, at least and at most. */
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 5;
export const POLL_QUESTION_MAX_LENGTH = 200;
export const POLL_OPTION_MAX_LENGTH = 80;

/** A `/poll` option: text, or a work shown with its poster. */
export interface MessagePollOptionDto {
  id: string;
  text: string;
  /** The work's page, for an option that's a work. */
  href: string | null;
  imageUrl: string | null;
  voters: UserSummaryDto[];
}

/** A `/poll`: votes stay open, a member changes theirs by voting again. */
export interface MessagePollDto {
  question: string;
  options: MessagePollOptionDto[];
  /** The option the viewer voted for. */
  myVote: string | null;
}

/** Domains `/saga` shares a saga of. */
export type SagaDomain = Extract<Domain, "MEDIA" | "GAMES" | "BOOKS">;

/** A saga shared with `/saga`; its card is read from `GET /chat/messages/:id/saga`. */
export interface MessageSagaRefDto {
  domain: SagaDomain;
  /** `TMDB:10194`, `ANILIST:16498`, `IGDB:18` or an Open Library series id. */
  key: string;
}

/** Domains `/pick` draws in: the ones with a pile. */
export type PickDomain = Extract<Domain, "MEDIA" | "GAMES" | "BOOKS" | "MUSIC">;

/** What a `/pick` drew from; the work drawn is the message's first card. */
export interface MessagePickDto {
  domain: PickDomain;
  /** Only from the works every member has in their own pile. */
  shared: boolean;
  /** How many works the draw was among. */
  count: number;
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
  /** Attached with `/review`. */
  review: MessageReviewDto | null;
  /** Attached with `/list`. */
  list: MessageListDto | null;
  gone: MessageGoneAttachment | null;
  poll: MessagePollDto | null;
  saga: MessageSagaRefDto | null;
  pick: MessagePickDto | null;
  /**
   * `/where`: where the first card's work can be watched, read from
   * `GET /chat/messages/:id/where`.
   */
  where: boolean;
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

/** `GET /chat/unread`: what the Messages launcher shows. Muted conversations and discussions don't count. */
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
  /**
   * Up to when the viewer has read: where the "new" line goes. Null for a
   * discussion they never took part in.
   */
  lastReadAt: string | null;
  /** Muted: its unread still shows on it, but counts nowhere else. */
  muted: boolean;
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
  /** Optional when a work, a review or a list is attached. */
  text?: string;
  spoiler?: boolean;
  /** A work page's path (`/app/games/1942`), attached to the message as a card. */
  work?: string;
  /** One of the author's reviews, by id (`/review`). */
  review?: string;
  /** A list both members may see, by id (`/list`). */
  list?: string;
  /** `/poll`: the question goes here rather than in `text`. */
  poll?: SendPollRequestDto;
  saga?: MessageSagaRefDto;
  /** `/pick`: a work drawn by `POST /chat/conversations/:id/pick`. */
  pick?: SendPickRequestDto;
  /** `/where`: a film's or a series' page path (`/app/media/movie/603`). */
  where?: string;
  /** Links whose card the writer turned down: they stay plain links. */
  skipLinks?: string[];
}

export interface SendPollRequestDto {
  question: string;
  /** Text, or a work's page path for an option that's a work. */
  options: { text?: string; work?: string }[];
}

export interface SendPickRequestDto {
  domain: PickDomain;
  shared: boolean;
  /** The work drawn, by its page path. */
  work: string;
}

/** `POST /chat/conversations/:id/pick`: a draw, before it's sent. */
export interface PickRequestDto {
  domain: PickDomain;
  shared: boolean;
}

export interface PickResultDto {
  /** Null when there's nothing to draw from. */
  work: MessageWorkDto | null;
  /** Works in the author's own pile. */
  mine: number;
  /**
   * Works every member has in their pile; 0 also when a member doesn't let
   * the author see their library in this domain.
   */
  shared: number;
}

/** `PUT /chat/messages/:id/vote`. */
export interface VotePollRequestDto {
  option: string;
}

/** Where someone stands in a work of a saga. */
export type SagaStep = "done" | "active" | "none";

/** `GET /chat/messages/:id/saga`: the saga with each member's progress. */
export interface MessageSagaDto {
  domain: SagaDomain;
  title: string;
  /** In viewing (or reading, release) order. */
  works: {
    title: string;
    imageUrl: string | null;
    href: string | null;
    /** Announced, not out yet. */
    upcoming: boolean;
  }[];
  /**
   * One row per member whose library in this domain the viewer may see, the
   * viewer first; `steps` follows `works`.
   */
  members: { user: UserSummaryDto; mine: boolean; steps: SagaStep[] }[];
}

/** How a platform offers a work. */
export type WatchOfferKind = "flatrate" | "free" | "ads" | "rent" | "buy";

/** `GET /chat/messages/:id/where`: who can watch the work, and where. */
export interface MessageWhereDto {
  /** The viewer's region the offers are for ("FR"). */
  region: string;
  /** Platforms a member has first, then the rest by kind. */
  offers: {
    provider: WatchProviderDto;
    kind: WatchOfferKind;
    /** Members who share their platforms and have this one. */
    members: UserSummaryDto[];
  }[];
  /** JustWatch's page for the region, which the offers come from. */
  link: string | null;
}

export interface EditMessageRequestDto {
  text: string;
  spoiler?: boolean;
  skipLinks?: string[];
}

/** "Recommander": the work goes to each friend in their own conversation. */
/** `POST /chat/works/:type/:id/unread`: unread again from this comment on. */
export interface MarkWorkUnreadRequestDto {
  commentId: string;
}

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
