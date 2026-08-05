import {
  classifyStaleness,
  computeLongestBinge,
  computeTypeSplit,
  countCompletedSeasons,
  GHOST_AFTER_DAYS,
  lastWatchedPerMediaItem,
  runtimeFor,
} from "./video-stats.util";

describe("runtimeFor", () => {
  it("uses the real runtime when known", () => {
    expect(runtimeFor("MOVIE", 142)).toBe(142);
  });

  it("falls back to the per-type default when unknown", () => {
    expect(runtimeFor("MOVIE", null)).toBe(110);
    expect(runtimeFor("SERIES", 0)).toBe(42);
    expect(runtimeFor("ANIME", null)).toBe(24);
  });
});

describe("computeTypeSplit", () => {
  it("returns nothing for no rows", () => {
    expect(computeTypeSplit([])).toEqual([]);
  });

  it("groups by type and sorts by minutes descending", () => {
    const result = computeTypeSplit([
      { type: "SERIES", minutes: 40 },
      { type: "SERIES", minutes: 40 },
      { type: "MOVIE", minutes: 200 },
      { type: "ANIME", minutes: 20 },
    ]);

    expect(result).toEqual([
      { type: "MOVIE", count: 1, minutes: 200 },
      { type: "SERIES", count: 2, minutes: 80 },
      { type: "ANIME", count: 1, minutes: 20 },
    ]);
  });
});

describe("computeLongestBinge", () => {
  it("returns 0 for no watches", () => {
    expect(computeLongestBinge([])).toBe(0);
  });

  it("returns 1 for a single watch", () => {
    expect(computeLongestBinge([new Date("2026-01-01T10:00:00Z")])).toBe(1);
  });

  it("counts every watch within a 24h window, ignores ones outside it", () => {
    const base = new Date("2026-01-01T00:00:00Z").getTime();
    const hours = (h: number) => new Date(base + h * 3600_000);
    // 5 watches within 24h, then a 6th 30h later (outside the window).
    const watches = [
      hours(0),
      hours(4),
      hours(8),
      hours(12),
      hours(23),
      hours(54),
    ];
    expect(computeLongestBinge(watches)).toBe(5);
  });

  it("is order-independent (sorts internally)", () => {
    const base = new Date("2026-01-01T00:00:00Z").getTime();
    const hours = (h: number) => new Date(base + h * 3600_000);
    expect(computeLongestBinge([hours(10), hours(0), hours(5)])).toBe(3);
  });
});

describe("countCompletedSeasons", () => {
  it("counts only fully-watched, non-empty seasons", () => {
    const result = countCompletedSeasons([
      { totalEpisodes: 10, watchedEpisodes: 10 },
      { totalEpisodes: 8, watchedEpisodes: 5 },
      { totalEpisodes: 0, watchedEpisodes: 0 },
      { totalEpisodes: 12, watchedEpisodes: 12 },
    ]);
    expect(result).toBe(2);
  });
});

describe("lastWatchedPerMediaItem", () => {
  it("keeps the max watchedAt per media item", () => {
    const result = lastWatchedPerMediaItem([
      { mediaItemId: "a", watchedAt: new Date("2026-01-01") },
      { mediaItemId: "a", watchedAt: new Date("2026-03-01") },
      { mediaItemId: "b", watchedAt: new Date("2026-02-01") },
    ]);
    expect(result.get("a")).toEqual(new Date("2026-03-01"));
    expect(result.get("b")).toEqual(new Date("2026-02-01"));
  });
});

describe("classifyStaleness", () => {
  const now = new Date("2026-07-01T00:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("returns null (active) under 30 days", () => {
    expect(classifyStaleness(daysAgo(10), now)).toBeNull();
    expect(classifyStaleness(daysAgo(29), now)).toBeNull();
  });

  it("returns PAUSED between 30 and 180 days", () => {
    expect(classifyStaleness(daysAgo(30), now)).toBe("PAUSED");
    expect(classifyStaleness(daysAgo(179), now)).toBe("PAUSED");
  });

  it("returns GHOST at 180+ days", () => {
    expect(classifyStaleness(daysAgo(GHOST_AFTER_DAYS), now)).toBe("GHOST");
    expect(classifyStaleness(daysAgo(400), now)).toBe("GHOST");
  });
});
