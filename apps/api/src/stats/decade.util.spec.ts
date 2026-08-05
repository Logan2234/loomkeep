import { computeDecadeHistogram } from "./decade.util";

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
