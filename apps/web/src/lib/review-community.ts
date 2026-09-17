import type { ReviewDto } from "@loomkeep/shared";

type Rated = Pick<ReviewDto, "rating" | "byFriend">;
type Arrangeable = Pick<ReviewDto, "voteScore" | "byFriend" | "updatedAt">;

export type ReviewArrangement = "useful" | "recent" | "friends";

export interface ReviewSummary {
  count: number;
  average: number | null;
  friendsAverage: number | null;
  /** Index = integer rating (0–10). */
  distribution: number[];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Computed client-side from the already-loaded list: `GET /reviews/:type/:id`
 * isn't paginated, and it is already visibility-filtered for this viewer, so
 * the summary never reveals a rating the viewer couldn't otherwise read.
 */
export function summarizeReviews(reviews: Rated[]): ReviewSummary {
  const distribution = Array<number>(11).fill(0);

  for (const review of reviews) {
    distribution[Math.round(review.rating)]++;
  }

  return {
    count: reviews.length,
    average: mean(reviews.map((r) => r.rating)),
    friendsAverage: mean(
      reviews.filter((r) => r.byFriend).map((r) => r.rating),
    ),
    distribution,
  };
}

const byRecent = (a: Arrangeable, b: Arrangeable) =>
  b.updatedAt.localeCompare(a.updatedAt);

export function arrangeReviews<T extends Arrangeable>(
  reviews: T[],
  arrangement: ReviewArrangement,
): T[] {
  if (arrangement === "friends") {
    return reviews.filter((r) => r.byFriend).sort(byRecent);
  }

  if (arrangement === "recent") {
    return [...reviews].sort(byRecent);
  }

  return [...reviews].sort(
    (a, b) => b.voteScore - a.voteScore || byRecent(a, b),
  );
}
