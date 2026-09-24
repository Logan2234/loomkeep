import {
  classifyStaleness,
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
