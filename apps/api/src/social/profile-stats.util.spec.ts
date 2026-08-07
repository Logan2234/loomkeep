import { earliest, latest } from "./profile-stats.util";

describe("earliest/latest", () => {
  it("returns null on an empty list", () => {
    expect(earliest([])).toBeNull();
    expect(latest([])).toBeNull();
  });

  it("finds the min/max among a handful of dates", () => {
    const dates = [
      new Date("2026-03-01"),
      new Date("2024-01-15"),
      new Date("2025-07-04"),
    ];
    expect(earliest(dates)).toEqual(new Date("2024-01-15"));
    expect(latest(dates)).toEqual(new Date("2026-03-01"));
  });

  // The bug this guards against: Math.min(...dates.map(d => d.getTime()))
  // throws "Maximum call stack size exceeded" once the array is large
  // enough to spread as call arguments (V8's limit is in the tens of
  // thousands) — a real scenario for a long-lived account's full watch
  // history. This must stay a plain O(n) reduce, not a spread call.
  it("doesn't blow the call stack on a very large list", () => {
    const dates = Array.from(
      { length: 200_000 },
      (_, i) => new Date(2020, 0, 1 + i),
    );
    expect(() => earliest(dates)).not.toThrow();
    expect(() => latest(dates)).not.toThrow();
    expect(earliest(dates)).toEqual(dates[0]);
    expect(latest(dates)).toEqual(dates[dates.length - 1]);
  });
});
