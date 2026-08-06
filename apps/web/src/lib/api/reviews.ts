import type {
  MyReviewDto,
  ReviewDto,
  ReviewRevisionDto,
  ReviewTargetType,
  ReviewVisibility,
  ReviewVoteValue,
  UpsertReviewDto,
} from "@loomkeep/shared";
import { request } from "./core";

export function getMyReviews(): Promise<MyReviewDto[]> {
  return request("/reviews/me");
}

/** The current user's own review for a target, or null. Always available. */
export function getMyReview(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<ReviewDto | null> {
  return request(`/reviews/me/${targetType}/${encodeURIComponent(targetId)}`);
}

/**
 * Others' reviews for a target, visibility-filtered (social-gated server-side —
 * fails when SOCIAL_ENABLED is off, so only call it when social is enabled).
 */
export function getReviewsForTarget(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<ReviewDto[]> {
  return request(`/reviews/${targetType}/${encodeURIComponent(targetId)}`);
}

export function upsertReview(
  targetType: ReviewTargetType,
  targetId: string,
  body: UpsertReviewDto,
): Promise<ReviewDto> {
  return request(`/reviews/me/${targetType}/${encodeURIComponent(targetId)}`, {
    method: "PUT",
    body,
  });
}

export function deleteReview(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<void> {
  return request(`/reviews/me/${targetType}/${encodeURIComponent(targetId)}`, {
    method: "DELETE",
  });
}

export function getReviewRevisions(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<ReviewRevisionDto[]> {
  return request(
    `/reviews/me/${targetType}/${encodeURIComponent(targetId)}/revisions`,
  );
}

/** Bulk-delete the given reviews (by review id). Returns the count deleted. */
export function batchDeleteReviews(ids: string[]): Promise<{ count: number }> {
  return request("/reviews/me/batch/delete", { method: "POST", body: { ids } });
}

/** Bulk-set the audience of the given reviews. Returns the count updated. */
export function batchSetReviewVisibility(
  ids: string[],
  visibility: ReviewVisibility,
): Promise<{ count: number }> {
  return request("/reviews/me/batch/visibility", {
    method: "POST",
    body: { ids, visibility },
  });
}

/** Casts (or replaces) the viewer's vote on someone else's review. */
export function voteReview(
  reviewId: string,
  value: ReviewVoteValue,
): Promise<{ score: number; myVote: ReviewVoteValue }> {
  return request(`/reviews/${reviewId}/vote`, {
    method: "PUT",
    body: { value },
  });
}

/** Removes the viewer's vote on a review, if any. */
export function unvoteReview(reviewId: string): Promise<{ score: number }> {
  return request(`/reviews/${reviewId}/vote`, { method: "DELETE" });
}
