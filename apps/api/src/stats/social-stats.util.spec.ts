import {
  computeAvgReviewLength,
  computeReciprocityRate,
  computeRatingVsCommunity,
  computeSpoilerRatio,
} from "./social-stats.util";

describe("computeAvgReviewLength", () => {
  it("returns null when no review has text", () => {
    expect(computeAvgReviewLength([null, ""])).toBeNull();
  });

  it("averages the length of non-empty texts only", () => {
    expect(computeAvgReviewLength(["abcd", null, "ab"])).toBe(3);
  });
});

describe("computeSpoilerRatio", () => {
  it("returns 0 for no comments", () => {
    expect(computeSpoilerRatio([])).toBe(0);
  });

  it("computes the tagged share", () => {
    expect(
      computeSpoilerRatio([
        { spoilerTag: true },
        { spoilerTag: false },
        { spoilerTag: false },
        { spoilerTag: false },
      ]),
    ).toBe(0.25);
  });
});

describe("computeRatingVsCommunity", () => {
  it("reports insufficient data below the threshold", () => {
    const works = Array.from({ length: 5 }, () => ({
      yourRating: 7,
      otherRatings: [8],
    }));
    expect(computeRatingVsCommunity(works)).toEqual({
      sufficientData: false,
      sampleSize: 5,
    });
  });

  it("only counts works with at least one other rating toward the sample", () => {
    const works = [
      ...Array.from({ length: 10 }, () => ({
        yourRating: 7,
        otherRatings: [8],
      })),
      { yourRating: 9, otherRatings: [] },
    ];
    const result = computeRatingVsCommunity(works);
    expect(result).toMatchObject({ sufficientData: true, sampleSize: 10 });
  });

  it("averages your rating and the per-work community average", () => {
    const works = Array.from({ length: 10 }, () => ({
      yourRating: 6,
      otherRatings: [8, 10],
    }));
    const result = computeRatingVsCommunity(works);
    expect(result).toEqual({
      sufficientData: true,
      yourAverage: 6,
      communityAverage: 9,
      sampleSize: 10,
    });
  });
});

describe("computeReciprocityRate", () => {
  it("returns 0 with no new followers", () => {
    expect(computeReciprocityRate([], new Set())).toBe(0);
  });

  it("computes the share of new followers also followed back", () => {
    const rate = computeReciprocityRate(
      ["a", "b", "c", "d"],
      new Set(["a", "c"]),
    );
    expect(rate).toBe(0.5);
  });
});
