import type {
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
import { typedRequest } from "./generated/typed-request";

export const getCommentCount = (
  targetType: CommentTargetType,
  targetId: string,
) =>
  typedRequest("/comments/{type}/{id}/count", {
    params: { type: targetType, id: targetId },
  });

// Not migrated: query-string params aren't supported by typedRequest yet.
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
