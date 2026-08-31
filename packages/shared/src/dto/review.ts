import type {
  ReviewTargetType,
  ReviewVisibility,
  ReviewVoteValue,
} from "../enums";
import type { UserSummaryDto } from "./social";

/** A review: a mandatory /10 rating + optional text on a target. */
export interface ReviewDto {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  rating: number;
  text: string | null;
  visibility: ReviewVisibility;
  createdAt: string;
  updatedAt: string;
  /** Null once the author's account has been deleted — rating/text stay, identity doesn't. */
  author: UserSummaryDto | null;
  /** Upvotes minus downvotes — never negative-only display, just the net. */
  voteScore: number;
  /** The viewer's own vote on this review, or null if they haven't voted. */
  myVote: ReviewVoteValue | null;
}

/** Minimal display info for the work a review targets. */
export interface ReviewTargetSummaryDto {
  title: string;
  imageUrl: string | null;
  /**
   * Client route to the work's detail page (e.g. `/games/1234`), or null when
   * the target has no browsable page yet (SEASON/EPISODE). Built server-side
   * from the canonical source id so the client needn't know the URL scheme.
   */
  href: string | null;
}

/** A review plus its resolved target, for the "Mes reviews" screen. */
export interface MyReviewDto extends ReviewDto {
  target: ReviewTargetSummaryDto | null;
}

/** One historised snapshot of a review (V1, V2, …), newest first. */
export interface ReviewRevisionDto {
  rating: number;
  text: string | null;
  createdAt: string;
}

/** Create-or-update a review for a target (identified by the route). */
export interface UpsertReviewDto {
  rating: number;
  text?: string | null;
  visibility?: ReviewVisibility;
}

/** Count of reviews affected by a bulk delete/visibility change. */
export interface ReviewBatchResultDto {
  count: number;
}

/** Result of casting (or replacing) a vote on someone else's review. */
export interface ReviewVoteResultDto {
  score: number;
  myVote: ReviewVoteValue;
}

/** Result of removing the viewer's vote on a review. */
export interface ReviewUnvoteResultDto {
  score: number;
}
