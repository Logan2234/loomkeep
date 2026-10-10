import type { MessageDto } from "./dto/chat";
import type { CommentTargetType } from "./enums";

// WebSocket event names, shared between the API's EventsGateway (emitter)
// and the web client's realtime socket (listener). Payloads are kept minimal
// on purpose: most events are pure "something changed" signals the client
// resolves with its own invalidateQueries — the exception is import progress,
// frequent enough that resending the full state avoids an HTTP round trip per
// tick (see the client's setQueryData usage).

export const RealtimeEvent = {
  NOTIFICATION: "notification",
  REPORTS_COUNT: "reports-count",
  ACHIEVEMENT_UNLOCKED: "achievement-unlocked",
  IMPORT_PROGRESS: "import-progress",
  COMMENT_CHANGED: "comment-changed",
  COMMENT_PRESENCE: "comment-presence",
  LIST_UPDATED: "list-updated",
  ONBOARDING_UPDATED: "onboarding-updated",
  FOLLOW_REQUEST_CHANGED: "follow-request-changed",
  CHAT_MESSAGE: "chat-message",
  CHAT_READ: "chat-read",
  CHAT_TYPING: "chat-typing",
  CHAT_PRESENCE: "chat-presence",
  // Someone else wrote in a work's discussion the recipient takes part in.
  CHAT_WORK_ACTIVITY: "chat-work-activity",
} as const;
export type RealtimeEvent = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export interface ImportProgressEvent {
  done: number;
  total: number;
  status: "running" | "completed" | "failed";
}

export interface CommentPresenceEvent {
  targetType: string;
  targetId: string;
  count: number;
}

/**
 * A message created, edited, deleted or reacted to, as its recipient sees it
 * (`mine` and `myReaction` differ per member, so each gets its own copy).
 * Carried whole, like import progress: a conversation is read while it
 * changes, and a refetch per message would make every keystroke on the
 * other side cost a request.
 */
export interface ChatMessageEvent {
  conversationId: string;
  message: MessageDto;
}

/** A member read the conversation up to `lastReadAt`. */
export interface ChatReadEvent {
  conversationId: string;
  userId: string;
  lastReadAt: string;
}

/** Sent by the client while its user types; relayed to the other member. */
export interface ChatTypingEvent {
  conversationId: string;
  userId: string;
}

/** A work's discussion moved: the "Œuvres" tab counts it again. */
export interface ChatWorkActivityEvent {
  targetType: CommentTargetType;
  targetId: string;
}

/** A friend opened the app somewhere, or closed it everywhere. */
export interface ChatPresenceEvent {
  userId: string;
  online: boolean;
}
