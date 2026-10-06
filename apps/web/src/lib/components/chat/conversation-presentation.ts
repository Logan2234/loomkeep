import { chatPreview } from "#lib/chat/chat-markdown.js";
import { formatDate, formatTime } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import { localDayKey } from "#lib/xp-history.js";
import type { ConversationDto } from "@loomkeep/shared";

export function conversationName(conversation: ConversationDto): string {
  return conversation.peer?.displayName ?? m.chat_deleted_account();
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
      : chatPreview(last.text ?? "");

  return last.mine && !last.deleted ? m.chat_preview_mine({ text }) : text;
}

/** Today's messages by their time, older ones by their day. */
export function conversationTime(conversation: ConversationDto): string {
  const at = conversation.lastMessage?.createdAt ?? conversation.lastMessageAt;
  return localDayKey(new Date(at)) === localDayKey(new Date())
    ? formatTime(at)
    : formatDate(at, { day: "2-digit", month: "2-digit" });
}

/** The unread count worth showing: a muted conversation counts nothing. */
export function shownUnread(conversation: ConversationDto): number {
  return conversation.muted ? 0 : conversation.unread;
}
