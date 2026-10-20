import { parsePageQuery, toPagedResult } from "./pagination.util";

describe("parsePageQuery", () => {
  it("defaults to page 1 and the given default limit when both are omitted", () => {
    expect(parsePageQuery(undefined, undefined, 20)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it("computes skip from page and limit", () => {
    expect(parsePageQuery("3", "10", 20)).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
      take: 10,
    });
  });

  it("falls back to page 1 for a non-positive or non-numeric page", () => {
    expect(parsePageQuery("0", undefined, 20).page).toBe(1);
    expect(parsePageQuery("-5", undefined, 20).page).toBe(1);
    expect(parsePageQuery("nope", undefined, 20).page).toBe(1);
  });

  it("falls back to the default limit for a non-positive or non-numeric limit", () => {
    expect(parsePageQuery(undefined, "0", 20).limit).toBe(20);
    expect(parsePageQuery(undefined, "-5", 20).limit).toBe(20);
    expect(parsePageQuery(undefined, "nope", 20).limit).toBe(20);
  });

  it("clamps an excessive limit to the max", () => {
    expect(parsePageQuery(undefined, "100000", 20).limit).toBe(200);
  });

  it("truncates a fractional page/limit", () => {
    expect(parsePageQuery("2.9", "10.9", 20)).toMatchObject({
      page: 2,
      limit: 10,
    });
  });
});

describe("toPagedResult", () => {
  it.each([
    { rows: [], items: [], hasMore: false },
    { rows: ["a"], items: ["a"], hasMore: false },
    { rows: ["a", "b"], items: ["a", "b"], hasMore: false },
    { rows: ["a", "b", "c"], items: ["a", "b"], hasMore: true },
  ])(
    "keeps a full page only when another row exists: $rows",
    ({ rows, items, hasMore }) => {
      expect(toPagedResult(rows, 2)).toEqual({ items, hasMore });
    },
  );

  it("leaves the fetched rows intact", () => {
    const rows = Object.freeze([1, 2, 3]);
    expect(toPagedResult(rows, 2)).toEqual({ items: [1, 2], hasMore: true });
    expect(rows).toEqual([1, 2, 3]);
  });
});
