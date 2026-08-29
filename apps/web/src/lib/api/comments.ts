import type {
  CommentCountDto,
  CommentDto,
  CommentEmote,
  CommentTargetType,
  CreateCommentDto,
  PagedResult,
  ReportCategory,
  ReportMotif,
  UpdateCommentDto,
} from "@loomkeep/shared";
import { request } from "./core";

export const getCommentCount = (
  targetType: CommentTargetType,
  targetId: string,
): Promise<CommentCountDto> =>
  request(`/comments/${targetType}/${encodeURIComponent(targetId)}/count`);

export function getComments(
  targetType: CommentTargetType,
  targetId: string,
  page = 1,
): Promise<PagedResult<CommentDto>> {
  const params = new URLSearchParams({ page: String(page) });
  return request(
    `/comments/${targetType}/${encodeURIComponent(targetId)}?${params}`,
  );
}

export const createComment = (body: CreateCommentDto): Promise<CommentDto> =>
  request("/comments", { method: "POST", body });

export const updateComment = (
  id: string,
  body: UpdateCommentDto,
): Promise<CommentDto> => request(`/comments/${id}`, { method: "PUT", body });

export const deleteComment = (id: string): Promise<void> =>
  request(`/comments/${id}`, { method: "DELETE" });

export const reactToComment = (
  id: string,
  emote: CommentEmote,
): Promise<void> =>
  request(`/comments/${id}/react`, { method: "POST", body: { emote } });

export const unreactToComment = (id: string): Promise<void> =>
  request(`/comments/${id}/react`, { method: "DELETE" });

export const reportComment = (
  id: string,
  category: ReportCategory,
  motif?: ReportMotif,
  reason?: string,
): Promise<void> =>
  request(`/comments/${id}/report`, {
    method: "POST",
    body: { category, motif, reason },
  });
