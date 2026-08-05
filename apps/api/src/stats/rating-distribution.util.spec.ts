import {
  computeAverageRating,
  computeRatingDistribution,
} from "./rating-distribution.util";

describe("computeRatingDistribution", () => {
  it("returns 10 zero-filled buckets for no ratings", () => {
    const result = computeRatingDistribution([]);
    expect(result).toHaveLength(10);
    expect(result.every((b) => b.count === 0)).toBe(true);
    expect(result.map((b) => b.rating)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("rounds float ratings to the nearest integer bucket", () => {
    const result = computeRatingDistribution([7.4, 7.6, 10, 0.5]);
    const byRating = Object.fromEntries(result.map((b) => [b.rating, b.count]));
    expect(byRating[7]).toBe(1);
    expect(byRating[8]).toBe(1);
    expect(byRating[10]).toBe(1);
    // 0.5 clamps up into the 1 bucket — ratings are always >= 1 in practice.
    expect(byRating[1]).toBe(1);
  });
});

describe("computeAverageRating", () => {
  it("returns null for no ratings", () => {
    expect(computeAverageRating([])).toBeNull();
  });

  it("rounds the mean to one decimal", () => {
    expect(computeAverageRating([7, 8, 9])).toBe(8);
    expect(computeAverageRating([7, 7, 8])).toBe(7.3);
  });
});
