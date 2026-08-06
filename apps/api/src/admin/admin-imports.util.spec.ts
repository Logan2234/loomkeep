import {
  buildImportSummary,
  importSuccessPercent,
  rankImportSources,
} from "./admin-imports.util";

describe("importSuccessPercent", () => {
  it("returns null while nothing was ever imported", () => {
    expect(importSuccessPercent(0, 0)).toBeNull();
  });

  it("counts failures in the denominator", () => {
    expect(importSuccessPercent(3, 1)).toBe(75);
  });

  it("reports 0 % when every run failed", () => {
    expect(importSuccessPercent(0, 5)).toBe(0);
  });
});

describe("rankImportSources", () => {
  const rows = [
    { sourceId: "steam", runs: 1, items: 40 },
    { sourceId: "tvtime", runs: 3, items: 120 },
    { sourceId: "goodreads", runs: 2, items: 40 },
  ];

  it("orders by items, most first", () => {
    expect(rankImportSources(rows).map((r) => r.sourceId)).toEqual([
      "tvtime",
      "goodreads",
      "steam",
    ]);
  });

  it("breaks ties on the source id so the order is stable between refreshes", () => {
    const tied = [
      { sourceId: "steam", runs: 1, items: 10 },
      { sourceId: "goodreads", runs: 1, items: 10 },
    ];
    expect(rankImportSources(tied).map((r) => r.sourceId)).toEqual([
      "goodreads",
      "steam",
    ]);
  });

  it("honours the limit", () => {
    expect(rankImportSources(rows, 1)).toHaveLength(1);
  });

  it("leaves the caller's array untouched", () => {
    rankImportSources(rows);
    expect(rows[0].sourceId).toBe("steam");
  });
});

describe("buildImportSummary", () => {
  it("assembles totals, rate and breakdown", () => {
    expect(
      buildImportSummary(3, 1, [{ sourceId: "tvtime", runs: 4, items: 120 }]),
    ).toEqual({
      total: 4,
      success: 3,
      failure: 1,
      successPercent: 75,
      bySource: [{ sourceId: "tvtime", runs: 4, items: 120 }],
    });
  });

  it("stays legible on an empty log", () => {
    expect(buildImportSummary(0, 0, [])).toEqual({
      total: 0,
      success: 0,
      failure: 0,
      successPercent: null,
      bySource: [],
    });
  });
});
