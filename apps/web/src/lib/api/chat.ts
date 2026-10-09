import type {
  ChatUnreadDto,
  CommentEmote,
  ConversationDto,
  ConversationWorkDto,
  EditMessageRequestDto,
  ForwardMessageRequestDto,
  MessageDto,
  PagedResult,
  RecommendWorkRequestDto,
  RecommendWorkResultDto,
  ReportCategory,
  ReportMotif,
  SendMessageRequestDto,
  UserSummaryDto,
} from "@loomkeep/shared";
import { request } from "./core";

const id = (value: string) => encodeURIComponent(value);

export const getConversations = (page = 1) =>
  request<PagedResult<ConversationDto>>(`/chat/conversations?page=${page}`);

export const getConversation = (conversationId: string) =>
  request<ConversationDto>(`/chat/conversations/${id(conversationId)}`);

/** Finds, or starts, the conversation with a friend. */
export const openConversation = (username: string) =>
  request<ConversationDto>("/chat/conversations", {
    method: "POST",
    body: { username },
  });

/** Newest first. */
export const getMessages = (conversationId: string, page = 1) =>
  request<PagedResult<MessageDto>>(
    `/chat/conversations/${id(conversationId)}/messages?page=${page}`,
  );

export const sendMessage = (
  conversationId: string,
  body: SendMessageRequestDto,
) =>
  request<MessageDto>(`/chat/conversations/${id(conversationId)}/messages`, {
    method: "POST",
    body,
  });

export const editMessage = (messageId: string, body: EditMessageRequestDto) =>
  request<MessageDto>(`/chat/messages/${id(messageId)}`, {
    method: "PUT",
    body,
  });

/** Sends the work to each friend, in their own conversation. */
export const recommendWork = (body: RecommendWorkRequestDto) =>
  request<RecommendWorkResultDto>("/chat/recommendations", {
    method: "POST",
    body,
  });

export const pinMessage = (messageId: string, pinned: boolean) =>
  request<void>(`/chat/messages/${id(messageId)}/pin`, {
    method: pinned ? "PUT" : "DELETE",
  });

export const searchMessages = (conversationId: string, query: string) =>
  request<MessageDto[]>(
    `/chat/conversations/${id(conversationId)}/search?q=${encodeURIComponent(query)}`,
  );

/** The conversation's shared works, once each, last shared first. */
export const getConversationWorks = (conversationId: string) =>
  request<ConversationWorkDto[]>(
    `/chat/conversations/${id(conversationId)}/works`,
  );

export const getPinnedMessages = (conversationId: string) =>
  request<MessageDto[]>(`/chat/conversations/${id(conversationId)}/pins`);

/** Unread again from this message on. */
export const markUnreadFrom = (messageId: string) =>
  request<void>(`/chat/messages/${id(messageId)}/unread`, { method: "POST" });

export const forwardMessage = (
  messageId: string,
  body: ForwardMessageRequestDto,
) =>
  request<RecommendWorkResultDto>(`/chat/messages/${id(messageId)}/forward`, {
    method: "POST",
    body,
  });

export const deleteMessage = (messageId: string) =>
  request<void>(`/chat/messages/${id(messageId)}`, { method: "DELETE" });

export const reactToMessage = (messageId: string, emote: CommentEmote) =>
  request<void>(`/chat/messages/${id(messageId)}/reaction`, {
    method: "PUT",
    body: { emote },
  });

export const unreactToMessage = (messageId: string) =>
  request<void>(`/chat/messages/${id(messageId)}/reaction`, {
    method: "DELETE",
  });

export const markConversationRead = (conversationId: string) =>
  request<void>(`/chat/conversations/${id(conversationId)}/read`, {
    method: "POST",
  });

export const muteConversation = (conversationId: string, muted: boolean) =>
  request<void>(`/chat/conversations/${id(conversationId)}/mute`, {
    method: "PUT",
    body: { muted },
  });

export const getChatFriends = (query = "") =>
  request<UserSummaryDto[]>(`/chat/friends?q=${encodeURIComponent(query)}`);

export const getChatUnread = () => request<ChatUnreadDto>("/chat/unread");

export const reportMessage = (
  messageId: string,
  category: ReportCategory,
  motif?: ReportMotif,
  reason?: string,
) =>
  request<void>(`/chat/messages/${id(messageId)}/report`, {
    method: "POST",
    body: { category, motif, reason },
  });
