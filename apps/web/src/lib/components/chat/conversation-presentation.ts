import { chatPreview } from "#lib/chat/chat-markdown.js";
import { formatDate, formatTime } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import { localDayKey } from "#lib/xp-history.js";
import {
  episodeCode,
  type CommentDto,
  type ConversationDto,
  type MessageDto,
  type MessageWorkKind,
  type WorkThreadDto,
} from "@loomkeep/shared";

export function conversationName(conversation: ConversationDto): string {
  return conversation.peer?.displayName ?? m.chat_deleted_account();
}

/** A search result, from a conversation or a work's discussion. */
export interface SearchHit {
  id: string;
  who: string;
  createdAt: string;
  text: string;
}

export function messageHit(message: MessageDto, peerName: string): SearchHit {
  return {
    id: message.id,
    who: message.mine ? m.common_you() : peerName,
    createdAt: message.createdAt,
    text: message.spoiler
      ? m.chat_spoiler_reveal()
      : chatPreview(message.text ?? ""),
  };
}

export function commentHit(comment: CommentDto): SearchHit {
  return {
    id: comment.id,
    who: comment.author?.displayName ?? m.chat_deleted_account(),
    createdAt: comment.createdAt,
    text: comment.masked ? m.chat_work_spoiler() : (comment.text ?? ""),
  };
}

/** The last line, as a conversation list shows it. */
export function conversationPreview(conversation: ConversationDto): string {
  const last = conversation.lastMessage;
  if (!last) return m.chat_new_conversation();

  const text = last.deleted
    ? last.deletedByAdmin
      ? m.chat_message_removed_by_admin()
      : m.chat_message_deleted()
    : last.spoiler
      ? m.chat_spoiler_reveal()
      : last.text
        ? chatPreview(last.text)
        : (last.works[0]?.title ?? "");

  return last.mine && !last.deleted ? m.chat_preview_mine({ text }) : text;
}

const KIND_LABELS: Record<MessageWorkKind, () => string> = {
  MOVIE: m.media_movie,
  SERIES: m.media_series,
  ANIME: m.media_anime,
  GAME: m.game_type,
  BOOK: m.common_Book,
  MUSIC: m.music_album,
};

export function workKindLabel(kind: MessageWorkKind): string {
  return KIND_LABELS[kind]();
}

/** Today's activity by its time, older one by its day. */
function listTime(at: string): string {
  return localDayKey(new Date(at)) === localDayKey(new Date())
    ? formatTime(at)
    : formatDate(at, { day: "2-digit", month: "2-digit" });
}

export function conversationTime(conversation: ConversationDto): string {
  return listTime(
    conversation.lastMessage?.createdAt ?? conversation.lastMessageAt,
  );
}

export function workThreadTime(thread: WorkThreadDto): string {
  return listTime(thread.lastActivityAt);
}

/** "Saison 2" or "S02E05", for a season's or an episode's discussion. */
export function workThreadContext(thread: WorkThreadDto): string | null {
  if (thread.seasonNumber === null) return null;
  return thread.episodeNumber === null
    ? `${m.common_season()} ${thread.seasonNumber}`
    : episodeCode(thread.seasonNumber, thread.episodeNumber);
}

/** The discussion's last comment, as the "Œuvres" list shows it. */
export function workThreadPreview(thread: WorkThreadDto): string {
  const last = thread.lastComment;
  if (!last) return "";

  const text =
    last.text === null ? m.chat_work_spoiler() : chatPreview(last.text);
  if (last.mine) return m.chat_preview_mine({ text });
  return last.authorName
    ? m.chat_work_preview({ name: last.authorName, text })
    : text;
}

/**
 * What a conversation adds to the totals (launcher, tab dot): nothing once
 * muted. Its own badge still shows its count, dimmed (see `badgeTone`).
 */
export function shownUnread(conversation: ConversationDto): number {
  return conversation.muted ? 0 : conversation.unread;
}

/** An unread badge's colours: amber, or quiet once muted. */
export function badgeTone(muted: boolean): string {
  return muted ? "bg-surface-2 text-dim" : "bg-accent text-accent-fg";
}

/**
 * Alt+↑ / Alt+↓: the conversation above or below in the list, from the open
 * one (or the first, when none is open). Null past either end.
 */
export function neighbourConversation(
  conversations: ConversationDto[],
  currentId: string | null,
  step: 1 | -1,
): string | null {
  if (conversations.length === 0) return null;
  const index = conversations.findIndex((c) => c.id === currentId);
  if (index === -1) return conversations[0].id;
  return conversations[index + step]?.id ?? null;
}

/**
 * Whether Messages' shortcuts apply: with the focus inside it, or nowhere
 * that types — a read-only conversation has no field to keep it.
 */
export function shortcutsReach(root: Element | null | undefined): boolean {
  const active = document.activeElement;

  if (!active || active === document.body || root?.contains(active)) {
    return true;
  }

  const typing =
    active instanceof HTMLElement &&
    (active.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName));
  return !typing;
}

/**
 * Whether Escape is Messages' to take: no menu or other dialog open on the
 * page, and no text being typed (Escape there clears or cancels first).
 */
export function escapeReaches(root: Element | null | undefined): boolean {
  const open = document.querySelector(
    '[aria-haspopup][aria-expanded="true"], [role="dialog"][aria-modal="true"]',
  );
  if (open) return false;
  const active = document.activeElement;

  if (
    (active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement) &&
    active.value !== ""
  ) {
    return false;
  }

  return shortcutsReach(root);
}

/** Alt+↑ / Alt+↓ in the "Œuvres" tab: the discussion above or below. */
export function neighbourWork(
  threads: WorkThreadDto[],
  current: { targetType: string; targetId: string } | null,
  step: 1 | -1,
): WorkThreadDto | null {
  if (threads.length === 0) return null;
  const index = threads.findIndex(
    (t) =>
      t.targetType === current?.targetType && t.targetId === current?.targetId,
  );
  if (index === -1) return threads[0];
  return threads[index + step] ?? null;
}

/** The step Alt+↑ / Alt+↓ asks for, or null for any other key. */
export function conversationStep(event: KeyboardEvent): 1 | -1 | null {
  if (!event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === "ArrowDown") return 1;
  if (event.key === "ArrowUp") return -1;
  return null;
}
