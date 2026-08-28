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

export function getCommentCount(
  targetType: CommentTargetType,
  targetId: string,
): Promise<CommentCountDto> {
  return request(
    `/comments/${targetType}/${encodeURIComponent(targetId)}/count`,
  );
}

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

export function createComment(body: CreateCommentDto): Promise<CommentDto> {
  return request("/comments", { method: "POST", body });
}

export function updateComment(
  id: string,
  body: UpdateCommentDto,
): Promise<CommentDto> {
  return request(`/comments/${id}`, { method: "PUT", body });
}

export function deleteComment(id: string): Promise<void> {
  return request(`/comments/${id}`, { method: "DELETE" });
}

export function reactToComment(id: string, emote: CommentEmote): Promise<void> {
  return request(`/comments/${id}/react`, { method: "POST", body: { emote } });
}

export function unreactToComment(id: string): Promise<void> {
  return request(`/comments/${id}/react`, { method: "DELETE" });
}

export function reportComment(
  id: string,
  category: ReportCategory,
  motif?: ReportMotif,
  reason?: string,
): Promise<void> {
  return request(`/comments/${id}/report`, {
    method: "POST",
    body: { category, motif, reason },
  });
}
