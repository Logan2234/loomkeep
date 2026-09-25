import { computeDecadeHistogram, computeLongestBinge } from "./aggregates.util";

describe("computeDecadeHistogram", () => {
  it("returns nothing for no dates", () => {
    expect(computeDecadeHistogram([])).toEqual([]);
  });

  it("excludes null dates", () => {
    expect(computeDecadeHistogram([null, null])).toEqual([]);
  });

  it("buckets by decade and sorts ascending", () => {
    const result = computeDecadeHistogram([
      new Date("1999-05-01"),
      new Date("2003-01-01"),
      new Date("1994-01-01"),
      new Date("2001-01-01"),
      null,
    ]);

    expect(result).toEqual([
      { decade: 1990, count: 2 },
      { decade: 2000, count: 2 },
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
