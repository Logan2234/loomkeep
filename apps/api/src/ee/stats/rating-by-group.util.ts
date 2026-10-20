import type { RatingByGroupDto } from "@loomkeep/shared";

export interface RatingByGroupInput {
  /** e.g. a game's platforms or genres — one row contributes to every group it's in. */
  groups: string[];
  rating: number | null;
}

/** Domain-agnostic: averages ratings per group label, skipping unrated rows. */
export function computeAverageRatingByGroup(
  rows: RatingByGroupInput[],
): RatingByGroupDto[] {
  const sums = new Map<string, { sum: number; count: number }>();

  for (const r of rows) {
    if (r.rating === null) continue;

    for (const g of r.groups) {
      const cur = sums.get(g) ?? { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count++;
      sums.set(g, cur);
    }
  }

  return [...sums.entries()]
    .map(([label, { sum, count }]) => ({
      label,
      averageRating: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.averageRating - a.averageRating);
}
