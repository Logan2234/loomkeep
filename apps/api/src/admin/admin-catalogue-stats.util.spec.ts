import { Domain } from "@tracklore/shared";
import {
  percent,
  rankPopularWorks,
  summariseReferences,
} from "./admin-catalogue-stats.util";

describe("percent", () => {
  it("rounds to the nearest point", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
  });

  it("returns 0 rather than NaN on an empty total", () => {
    expect(percent(0, 0)).toBe(0);
  });
});

describe("summariseReferences", () => {
  it("sums orphans and mutualisation across every domain", () => {
    const out = summariseReferences([
      // 5 media items, 3 referenced, 2 of them by ≥2 accounts.
      { totalItems: 5, entriesPerItem: [3, 2, 1] },
      // 3 game items, 1 referenced once.
      { totalItems: 3, entriesPerItem: [1] },
    ]);
    expect(out.orphanCount).toBe(4);
    // 2 shared out of 8 cached items.
    expect(out.sharedPercent).toBe(25);
  });

  it("handles an empty cache", () => {
    expect(
      summariseReferences([{ totalItems: 0, entriesPerItem: [] }]),
    ).toEqual({ orphanCount: 0, sharedPercent: 0 });
  });
});

describe("rankPopularWorks", () => {
  it("mixes every domain into a single descending ranking", () => {
    const out = rankPopularWorks(
      [
        { domain: Domain.MEDIA, title: "Breaking Bad", entries: 31 },
        { domain: Domain.MUSIC, title: "Radiohead — OK Computer", entries: 14 },
        { domain: Domain.GAMES, title: "Elden Ring", entries: 24 },
        { domain: Domain.BOOKS, title: "Dune", entries: 19 },
      ],
      3,
    );
    expect(out.map((w) => w.title)).toEqual([
      "Breaking Bad",
      "Elden Ring",
      "Dune",
    ]);
  });

  it("breaks ties on title so the order is stable between refreshes", () => {
    const out = rankPopularWorks([
      { domain: Domain.GAMES, title: "Zelda", entries: 4 },
      { domain: Domain.BOOKS, title: "Akira", entries: 4 },
    ]);
    expect(out.map((w) => w.title)).toEqual(["Akira", "Zelda"]);
  });
});
