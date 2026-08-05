import type { RatingBucketDto } from "@tracklore/shared";

/**
 * Buckets ratings into the 10 integer stars, always returning all 10 buckets
 * (zero-filled) so the histogram has a stable 1..10 axis regardless of what's
 * actually rated. Ratings are stored as a float /10 — bucketed by rounding.
 */
export function computeRatingDistribution(
  ratings: number[],
): RatingBucketDto[] {
  const counts = new Array<number>(10).fill(0);

  for (const rating of ratings) {
    const bucket = Math.min(10, Math.max(1, Math.round(rating)));
    counts[bucket - 1]++;
  }

  return counts.map((count, i) => ({ rating: i + 1, count }));
}

/** Arithmetic mean rounded to one decimal, or null when there's nothing rated. */
export function computeAverageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((s, r) => s + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
