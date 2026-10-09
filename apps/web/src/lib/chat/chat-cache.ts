import type {
  ConversationDto,
  MessageDto,
  PagedResult,
} from "@loomkeep/shared";
import type { InfiniteData } from "@tanstack/svelte-query";

/** A conversation's messages as cached: pages newest first, each newest first. */
export type MessagePages = InfiniteData<PagedResult<MessageDto>, number>;

/**
 * Puts a message where it belongs: replaced in place when already loaded (an
 * edit, a deletion, a reaction), else on top of the newest page. Pages are
 * fetched by offset, so a message can arrive both from a send's response and
 * from the socket: it is only ever kept once.
 */
export function upsertMessage(
  data: MessagePages | undefined,
  message: MessageDto,
): MessagePages | undefined {
  if (!data) return data;

  const found = data.pages.some((page) =>
    page.items.some((m) => m.id === message.id),
  );

  if (found) {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((m) => (m.id === message.id ? message : m)),
      })),
    };
  }

  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [{ ...first, items: [message, ...first.items] }, ...rest],
  };
}

/** Oldest first, each message once, for display. */
export function chronological(pages: PagedResult<MessageDto>[]): MessageDto[] {
  const seen = new Set<string>();
  const messages: MessageDto[] = [];

  for (const page of pages) {
    for (const message of page.items) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push(message);
    }
  }

  return messages.reverse();
}

/**
 * A new or changed message, reflected in the conversation list: its last
 * line, and its unread count when the other member wrote it and the
 * conversation isn't on screen. Null when the conversation isn't in the
 * list yet: the caller refetches it.
 */
export function applyToConversations(
  list: PagedResult<ConversationDto> | undefined,
  message: MessageDto,
  onScreen: boolean,
): PagedResult<ConversationDto> | undefined | null {
  if (!list) return list;

  const conversation = list.items.find((c) => c.id === message.conversationId);
  if (!conversation) return null;

  const isNew =
    !conversation.lastMessage ||
    message.createdAt > conversation.lastMessage.createdAt;
  const isLast = isNew || conversation.lastMessage?.id === message.id;
  const updated: ConversationDto = {
    ...conversation,
    lastMessage: isLast ? message : conversation.lastMessage,
    lastMessageAt: isNew ? message.createdAt : conversation.lastMessageAt,
    unread:
      isNew && !message.mine && !onScreen
        ? conversation.unread + 1
        : conversation.unread,
  };

  return {
    ...list,
    items: isNew
      ? [updated, ...list.items.filter((c) => c.id !== conversation.id)]
      : list.items.map((c) => (c.id === conversation.id ? updated : c)),
  };
}

/** The "Vu" goes under the viewer's last message the other member has read. */
export function seenMessageId(
  messages: MessageDto[],
  peerLastReadAt: string | null,
): string | null {
  if (!peerLastReadAt) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message.mine || message.deleted) continue;
    return message.createdAt <= peerLastReadAt ? message.id : null;
  }

  return null;
}
