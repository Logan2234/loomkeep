import {
  providerCallRows,
  shareOrNull,
  type ProviderQuotaSpec,
} from "./admin-system-stats.util";

describe("providerCallRows", () => {
  const specs: ProviderQuotaSpec[] = [
    { key: "tmdb", label: "TMDB", dailyLimit: null },
    { key: "googleBooks", label: "Google Books", dailyLimit: 1000 },
    { key: "omdb", label: "OMDb (notes)", dailyLimit: 1000 },
  ];

  it("labels, sorts by calls and computes the quota share when there is a limit", () => {
    const rows = providerCallRows(
      new Map([
        ["googleBooks", 820],
        ["tmdb", 3420],
      ]),
      specs,
    );

    expect(rows).toEqual([
      { provider: "TMDB", calls: 3420, dailyLimit: null, percentUsed: null },
      {
        provider: "Google Books",
        calls: 820,
        dailyLimit: 1000,
        percentUsed: 82,
      },
    ]);
  });

  it("drops providers with no call today", () => {
    const rows = providerCallRows(
      new Map([
        ["tmdb", 0],
        ["omdb", 5],
      ]),
      specs,
    );
    expect(rows.map((r) => r.provider)).toEqual(["OMDb (notes)"]);
  });

  it("keeps a counter whose provider isn't declared, under its raw key", () => {
    const rows = providerCallRows(new Map([["mystery", 12]]), specs);
    expect(rows).toEqual([
      { provider: "mystery", calls: 12, dailyLimit: null, percentUsed: null },
    ]);
  });

  it("breaks ties on the label so the order is stable between refreshes", () => {
    const rows = providerCallRows(
      new Map([
        ["omdb", 10],
        ["tmdb", 10],
      ]),
      specs,
    );
    expect(rows.map((r) => r.provider)).toEqual(["OMDb (notes)", "TMDB"]);
  });

  it("returns nothing when no call was recorded at all", () => {
    expect(providerCallRows(new Map(), specs)).toEqual([]);
  });
});

describe("shareOrNull", () => {
  it("distinguishes 'nothing to divide' from 'zero'", () => {
    expect(shareOrNull(0, 0)).toBeNull();
    expect(shareOrNull(0, 10)).toBe(0);
  });

  it("rounds to a whole percentage", () => {
    expect(shareOrNull(61, 100)).toBe(61);
    expect(shareOrNull(1, 3)).toBe(33);
  });
});
