import type {
  ReportCategory,
  ReportMotif,
  ReviewTargetType,
  ReviewVisibility,
  ReviewVoteValue,
  UpsertReviewDto,
} from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const getMyReviews = () => typedRequest("/reviews/me");

/** Not gated by the social feature or audience rules. */
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

export function batchDeleteReviews(ids: string[]) {
  return typedRequest("/reviews/me/batch/delete", {
    method: "POST",
    body: { ids },
  });
}

export function batchSetReviewVisibility(
  ids: string[],
  visibility: ReviewVisibility,
) {
  return typedRequest("/reviews/me/batch/visibility", {
    method: "POST",
    body: { ids, visibility },
  });
}

export function voteReview(reviewId: string, value: ReviewVoteValue) {
  return typedRequest("/reviews/{reviewId}/vote", {
    method: "PUT",
    params: { reviewId },
    body: { value },
  });
}

export function unvoteReview(reviewId: string) {
  return typedRequest("/reviews/{reviewId}/vote", {
    method: "DELETE",
    params: { reviewId },
  });
}

export const reportReview = (
  reviewId: string,
  category: ReportCategory,
  motif?: ReportMotif,
  reason?: string,
): Promise<void> =>
  typedRequest("/reviews/{reviewId}/report", {
    method: "POST",
    params: { reviewId },
    body: { category, motif, reason },
  });
