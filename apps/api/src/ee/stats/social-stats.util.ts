import type { RatingVsCommunityDto } from "@loomkeep/shared";
import { RATING_VS_COMMUNITY_MIN_SAMPLE } from "@loomkeep/shared";

export function computeAvgReviewLength(
  texts: (string | null)[],
): number | null {
  const lengths = texts
    .filter((t): t is string => !!t && t.length > 0)
    .map((t) => t.length);
  if (lengths.length === 0) return null;
  return Math.round(lengths.reduce((sum, l) => sum + l, 0) / lengths.length);
}

export function computeSpoilerRatio(
  comments: { spoilerTag: boolean }[],
): number {
  if (comments.length === 0) return 0;
  return comments.filter((c) => c.spoilerTag).length / comments.length;
}

/**
 * "Your average vs the community", computed per-work then averaged across
 * qualifying works (works you rated that at least one other user also
 * rated) — so one heavily-reviewed work can't dominate the comparison.
 */
export function computeRatingVsCommunity(
  works: { yourRating: number; otherRatings: number[] }[],
): RatingVsCommunityDto {
  const qualifying = works.filter((w) => w.otherRatings.length > 0);

  if (qualifying.length < RATING_VS_COMMUNITY_MIN_SAMPLE) {
    return { sufficientData: false, sampleSize: qualifying.length };
  }

  const yourAverage =
    qualifying.reduce((sum, w) => sum + w.yourRating, 0) / qualifying.length;
  const communityAverage =
    qualifying.reduce(
      (sum, w) =>
        sum + w.otherRatings.reduce((s, r) => s + r, 0) / w.otherRatings.length,
      0,
    ) / qualifying.length;

  return {
    sufficientData: true,
    yourAverage: Math.round(yourAverage * 10) / 10,
    communityAverage: Math.round(communityAverage * 10) / 10,
    sampleSize: qualifying.length,
  };
}

/** Share of `newFollowerIds` that the viewer also follows back (accepted). */
export function computeReciprocityRate(
  newFollowerIds: string[],
  viewerFollowsIds: Set<string>,
): number {
  if (newFollowerIds.length === 0) return 0;
  const reciprocated = newFollowerIds.filter((id) => viewerFollowsIds.has(id));
  return reciprocated.length / newFollowerIds.length;
}
