import {
  computeHeatmap,
  computeHourCounts,
  computeMonthlyCounts,
  computeMonthlyMinutes,
  computeStreak,
  computeStreaksByUser,
  computeWeekdayCounts,
  computeYearlyMinutes,
  mostActiveYear,
  windowStart,
} from "./video-temporal.util";

describe("windowStart", () => {
  const now = new Date("2026-08-15T00:00:00Z");

  it("returns null for ALL", () => {
    expect(windowStart("ALL", now)).toBeNull();
  });

  it("returns 7/30/365 days back for WEEK/MONTH/YEAR", () => {
    expect(windowStart("WEEK", now)).toEqual(new Date("2026-08-08T00:00:00Z"));
    expect(windowStart("MONTH", now)).toEqual(new Date("2026-07-16T00:00:00Z"));
    expect(windowStart("YEAR", now)).toEqual(new Date("2025-08-15T00:00:00Z"));
  });
});

describe("computeHeatmap", () => {
  it("zero-fills every day in the window", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    const result = computeHeatmap([], 5, now);
    expect(result).toHaveLength(5);
    expect(result.every((d) => d.count === 0)).toBe(true);
    expect(result[0].date).toBe("2026-01-06");
    expect(result[4].date).toBe("2026-01-10");
  });

  it("counts multiple watches on the same day, excludes out-of-window dates", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    const result = computeHeatmap(
      [
        new Date("2026-01-10T08:00:00Z"),
        new Date("2026-01-10T20:00:00Z"),
        new Date("2025-12-01T00:00:00Z"), // outside a 5-day window
      ],
      5,
      now,
    );
    expect(result.find((d) => d.date === "2026-01-10")?.count).toBe(2);
    expect(result.reduce((s, d) => s + d.count, 0)).toBe(2);
  });
});

describe("computeWeekdayCounts", () => {
  it("returns 7 zero-filled buckets, Sunday=0", () => {
    // 2026-08-16 is a Sunday (UTC).
    const result = computeWeekdayCounts([
      new Date("2026-08-16T10:00:00Z"),
      new Date("2026-08-16T11:00:00Z"),
      new Date("2026-08-18T10:00:00Z"), // Tuesday
    ]);
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ weekday: 0, count: 2 });
    expect(result[2]).toEqual({ weekday: 2, count: 1 });
  });
});

describe("computeHourCounts", () => {
  it("returns 24 zero-filled buckets", () => {
    const result = computeHourCounts([
      new Date("2026-08-16T21:30:00Z"),
      new Date("2026-08-17T21:45:00Z"),
    ]);
    expect(result).toHaveLength(24);
    expect(result[21].count).toBe(2);
    expect(result[0].count).toBe(0);
  });
});

describe("computeMonthlyMinutes", () => {
  it("zero-fills the last N calendar months and sums minutes", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const result = computeMonthlyMinutes(
      [
        { watchedAt: new Date("2026-08-01"), minutes: 60 },
        { watchedAt: new Date("2026-08-10"), minutes: 40 },
        { watchedAt: new Date("2026-06-01"), minutes: 30 },
        { watchedAt: new Date("2024-01-01"), minutes: 999 }, // outside 12mo
      ],
      3,
      now,
    );
    expect(result).toEqual([
      { month: "2026-06", minutes: 30 },
      { month: "2026-07", minutes: 0 },
      { month: "2026-08", minutes: 100 },
    ]);
  });
});

describe("computeMonthlyCounts", () => {
  it("zero-fills the last N calendar months and counts events", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const result = computeMonthlyCounts(
      [
        new Date("2026-08-01"),
        new Date("2026-08-10"),
        new Date("2026-06-01"),
        new Date("2024-01-01"), // outside 3mo
      ],
      3,
      now,
    );
    expect(result).toEqual([
      { month: "2026-06", count: 1 },
      { month: "2026-07", count: 0 },
      { month: "2026-08", count: 2 },
    ]);
  });
});

describe("computeYearlyMinutes", () => {
  it("groups by calendar year, ascending, only years with data", () => {
    const result = computeYearlyMinutes([
      { watchedAt: new Date("2024-03-01"), minutes: 100 },
      { watchedAt: new Date("2026-01-01"), minutes: 50 },
      { watchedAt: new Date("2024-12-01"), minutes: 20 },
    ]);
    expect(result).toEqual([
      { year: 2024, minutes: 120 },
      { year: 2026, minutes: 50 },
    ]);
  });
});

describe("mostActiveYear", () => {
  it("returns null for no data", () => {
    expect(mostActiveYear([])).toBeNull();
  });

  it("returns the year with the most minutes", () => {
    expect(
      mostActiveYear([
        { year: 2024, minutes: 120 },
        { year: 2025, minutes: 300 },
        { year: 2026, minutes: 50 },
      ]),
    ).toBe(2025);
  });
});

describe("computeStreak", () => {
  const now = new Date("2026-08-15T18:00:00Z");
  const daysAgo = (n: number) =>
    new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  it("returns 0 for no watches", () => {
    expect(computeStreak([], now)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak([daysAgo(0), daysAgo(1), daysAgo(2)], now)).toBe(3);
  });

  it("doesn't break the streak when today has no watch yet, but yesterday does", () => {
    expect(computeStreak([daysAgo(1), daysAgo(2), daysAgo(3)], now)).toBe(3);
  });

  it("breaks the streak on a two-day gap", () => {
    expect(computeStreak([daysAgo(2), daysAgo(3)], now)).toBe(0);
  });

  it("stops at the first gap even with older activity", () => {
    expect(computeStreak([daysAgo(0), daysAgo(1), daysAgo(5)], now)).toBe(2);
  });
});

describe("computeStreaksByUser", () => {
  const now = new Date("2026-08-15T18:00:00Z");
  const daysAgo = (n: number) =>
    new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  it("returns an empty map for no watches", () => {
    expect(computeStreaksByUser([], now)).toEqual(new Map());
  });

  it("computes each user's streak independently", () => {
    const result = computeStreaksByUser(
      [
        { userId: "a", watchedAt: daysAgo(0) },
        { userId: "a", watchedAt: daysAgo(1) },
        { userId: "b", watchedAt: daysAgo(0) },
        { userId: "b", watchedAt: daysAgo(5) },
      ],
      now,
    );
    expect(result.get("a")).toBe(2);
    expect(result.get("b")).toBe(1);
  });
});
