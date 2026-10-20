import {
  addDays,
  startOfUtcDay,
  startOfUtcMonth,
  utcDateKey,
  utcMonthRange,
  utcYearRange,
} from "./date.util";

describe("UTC dates", () => {
  it("uses the UTC day and month when an offset crosses their boundaries", () => {
    const date = new Date("2026-01-01T00:30:00+02:00");
    expect(startOfUtcDay(date).toISOString()).toBe("2025-12-31T00:00:00.000Z");
    expect(startOfUtcMonth(date).toISOString()).toBe(
      "2025-12-01T00:00:00.000Z",
    );
    expect(utcDateKey(date)).toBe("2025-12-31");
  });

  it("bounds a leap-year February and rolls December into the next year", () => {
    expect(utcMonthRange(new Date("2024-02-29T12:00:00Z"))).toEqual({
      gte: new Date("2024-02-01T00:00:00Z"),
      lt: new Date("2024-03-01T00:00:00Z"),
    });
    expect(utcMonthRange(new Date("2025-12-31T23:00:00Z"))).toEqual({
      gte: new Date("2025-12-01T00:00:00Z"),
      lt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(utcYearRange(2024)).toEqual({
      gte: new Date("2024-01-01T00:00:00Z"),
      lt: new Date("2025-01-01T00:00:00Z"),
    });
  });

  it("shifts fixed days across daylight saving without mutating the reference", () => {
    const date = new Date("2026-03-28T12:30:00Z");
    expect(addDays(date, 2).toISOString()).toBe("2026-03-30T12:30:00.000Z");
    expect(addDays(date, -1).toISOString()).toBe("2026-03-27T12:30:00.000Z");
    expect(date.toISOString()).toBe("2026-03-28T12:30:00.000Z");
  });
});
