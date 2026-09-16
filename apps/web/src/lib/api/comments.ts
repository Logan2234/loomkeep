import type {
  CommentDto,
  CommentEmote,
  CommentTargetType,
  CreateCommentDto,
  PagedResult,
  ReportCategory,
  ReportMotif,
  UpdateCommentDto,
  UserSummaryDto,
} from "@loomkeep/shared";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

export const getCommentCount = (
  targetType: CommentTargetType,
  targetId: string,
) =>
  typedRequest("/comments/{type}/{id}/count", {
    params: { type: targetType, id: targetId },
  });

export const getComments = (
  targetType: CommentTargetType,
  targetId: string,
  page = 1,
) =>
  request<PagedResult<CommentDto>>(
    `/comments/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}?page=${page}`,
  );

/**
 * One comment's replies, newest first — `getComments` only embeds a short
 * preview of each thread's tail.
 */
export const getCommentReplies = (id: string, page = 1) =>
  request<PagedResult<CommentDto>>(
    `/comments/${encodeURIComponent(id)}/replies?page=${page}`,
  );

export const getCommentParticipants = (
  targetType: CommentTargetType,
  targetId: string,
  query = "",
) =>
  request<UserSummaryDto[]>(
    `/comments/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/participants?q=${encodeURIComponent(query)}`,
  );

export const createComment = (body: CreateCommentDto) =>
  request<CommentDto>("/comments", { method: "POST", body });

export const updateComment = (id: string, body: UpdateCommentDto) =>
  request<CommentDto>(`/comments/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  });

export const deleteComment = (id: string): Promise<void> =>
  typedRequest("/comments/{id}", { method: "DELETE", params: { id } });

export const reactToComment = (
  id: string,
  emote: CommentEmote,
): Promise<void> =>
  typedRequest("/comments/{id}/react", {
    method: "POST",
    params: { id },
    body: { emote },
  });

export const unreactToComment = (id: string): Promise<void> =>
  typedRequest("/comments/{id}/react", { method: "DELETE", params: { id } });

export const reportComment = (
  id: string,
  category: ReportCategory,
  motif?: ReportMotif,
  reason?: string,
): Promise<void> =>
  typedRequest("/comments/{id}/report", {
    method: "POST",
    params: { id },
    body: { category, motif, reason },
  });
