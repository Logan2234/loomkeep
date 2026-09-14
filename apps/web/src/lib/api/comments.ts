import type {
  CommentEmote,
  CommentTargetType,
  CreateCommentDto,
  ReportCategory,
  ReportMotif,
  UpdateCommentDto,
} from "@loomkeep/shared";
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
  typedRequest("/comments/{type}/{id}", {
    params: { type: targetType, id: targetId },
    query: { page: String(page) },
  });

/**
 * One comment's replies, newest first — `getComments` only embeds a short
 * preview of each thread's tail.
 */
export const getCommentReplies = (id: string, page = 1) =>
  typedRequest("/comments/{id}/replies", {
    params: { id },
    query: { page: String(page) },
  });

export const createComment = (body: CreateCommentDto) =>
  typedRequest("/comments", { method: "POST", body });

export const updateComment = (id: string, body: UpdateCommentDto) =>
  typedRequest("/comments/{id}", { method: "PUT", params: { id }, body });

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
