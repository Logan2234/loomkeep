import type {
  ReviewTargetType,
  ReviewVisibility,
  ReviewVoteValue,
  UpsertReviewDto,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const getMyReviews = () => typedRequest("/reviews/me");

/** The current user's own review for a target, or null. Always available. */
export const getMyReview = (targetType: ReviewTargetType, targetId: string) =>
  typedRequest("/reviews/me/{type}/{id}", {
    params: { type: targetType, id: targetId },
  });

/**
 * Others' reviews for a target, visibility-filtered (social-gated server-side —
 * fails when SOCIAL_ENABLED is off, so only call it when social is enabled).
 */
export const getReviewsForTarget = (
  targetType: ReviewTargetType,
  targetId: string,
) =>
  typedRequest("/reviews/{type}/{id}", {
    params: { type: targetType, id: targetId },
  });

export const upsertReview = (
  targetType: ReviewTargetType,
  targetId: string,
  body: UpsertReviewDto,
) =>
  typedRequest("/reviews/me/{type}/{id}", {
    method: "PUT",
    params: { type: targetType, id: targetId },
    body,
  });

export const deleteReview = (
  targetType: ReviewTargetType,
  targetId: string,
): Promise<void> =>
  typedRequest("/reviews/me/{type}/{id}", {
    method: "DELETE",
    params: { type: targetType, id: targetId },
  });

export const getReviewRevisions = (
  targetType: ReviewTargetType,
  targetId: string,
) =>
  typedRequest("/reviews/me/{type}/{id}/revisions", {
    params: { type: targetType, id: targetId },
  });

/** Bulk-delete the given reviews (by review id). Returns the count deleted. */
export function batchDeleteReviews(ids: string[]) {
  return typedRequest("/reviews/me/batch/delete", {
    method: "POST",
    body: { ids },
  });
}

/** Bulk-set the audience of the given reviews. Returns the count updated. */
export function batchSetReviewVisibility(
  ids: string[],
  visibility: ReviewVisibility,
) {
  return typedRequest("/reviews/me/batch/visibility", {
    method: "POST",
    body: { ids, visibility },
  });
}

/** Casts (or replaces) the viewer's vote on someone else's review. */
export function voteReview(reviewId: string, value: ReviewVoteValue) {
  return typedRequest("/reviews/{reviewId}/vote", {
    method: "PUT",
    params: { reviewId },
    body: { value },
  });
}

/** Removes the viewer's vote on a review, if any. */
export function unvoteReview(reviewId: string) {
  return typedRequest("/reviews/{reviewId}/vote", {
    method: "DELETE",
    params: { reviewId },
  });
}
