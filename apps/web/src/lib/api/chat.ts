import type {
  ChatUnreadDto,
  CommentEmote,
  ConversationDto,
  MessageDto,
  PagedResult,
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

export const editMessage = (messageId: string, body: SendMessageRequestDto) =>
  request<MessageDto>(`/chat/messages/${id(messageId)}`, {
    method: "PUT",
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
