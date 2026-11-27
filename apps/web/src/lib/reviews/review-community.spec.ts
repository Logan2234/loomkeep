import { describe, expect, it } from "vitest";
import { arrangeReviews, summarizeReviews } from "./review-community";

function r(
  id: string,
  rating: number,
  over: { voteScore?: number; byFriend?: boolean; updatedAt?: string } = {},
) {
  return {
    id,
    rating,
    voteScore: over.voteScore ?? 0,
    byFriend: over.byFriend ?? false,
    updatedAt: over.updatedAt ?? "2026-09-01T00:00:00.000Z",
  };
}

describe("summarizeReviews", () => {
  it("averages every rating and counts each integer bucket", () => {
    const s = summarizeReviews([r("a", 8), r("b", 6), r("c", 8), r("d", 10)]);
    expect(s.count).toBe(4);
    expect(s.average).toBe(8);
    expect(s.distribution).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 1]);
  });

  it("puts a legacy half-point rating in its rounded bucket but keeps it exact in the average", () => {
    const s = summarizeReviews([r("a", 8.5), r("b", 7)]);
    expect(s.distribution[9]).toBe(1);
    expect(s.average).toBe(7.75);
  });

  it("averages friends separately, and has no average without ratings", () => {
    const s = summarizeReviews([
      r("a", 4),
      r("b", 9, { byFriend: true }),
      r("c", 7, { byFriend: true }),
    ]);
    expect(s.friendsAverage).toBe(8);
    expect(summarizeReviews([r("a", 4)]).friendsAverage).toBeNull();
    expect(summarizeReviews([]).average).toBeNull();
  });
});

describe("arrangeReviews", () => {
  const list = [
    r("old-popular", 5, { voteScore: 9, updatedAt: "2026-01-01T00:00:00Z" }),
    r("new-friend", 5, {
      voteScore: 1,
      byFriend: true,
      updatedAt: "2026-09-01T00:00:00Z",
    }),
    r("mid-tie", 5, { voteScore: 1, updatedAt: "2026-05-01T00:00:00Z" }),
  ];

  it("sorts by net score, newest first on a tie", () => {
    expect(arrangeReviews(list, "useful").map((x) => x.id)).toEqual([
      "old-popular",
      "new-friend",
      "mid-tie",
    ]);
  });

  it("sorts by most recent edit", () => {
    expect(arrangeReviews(list, "recent").map((x) => x.id)).toEqual([
      "new-friend",
      "mid-tie",
      "old-popular",
    ]);
  });

  it("keeps only friends' reviews, newest first", () => {
    expect(arrangeReviews(list, "friends").map((x) => x.id)).toEqual([
      "new-friend",
    ]);
  });

  it("never mutates its input", () => {
    const before = list.map((x) => x.id);
    arrangeReviews(list, "recent");
    expect(list.map((x) => x.id)).toEqual(before);
  });
});
