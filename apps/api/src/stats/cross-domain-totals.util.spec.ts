import type { DomainStatusBreakdownDto } from "@loomkeep/shared";

import { sumStatusBreakdowns } from "./cross-domain-totals.util";

function domain(
  over: Partial<DomainStatusBreakdownDto> = {},
): DomainStatusBreakdownDto {
  return {
    domain: "MEDIA",
    total: 0,
    favorites: 0,
    byStatus: [],
    ...over,
  };
}

describe("sumStatusBreakdowns", () => {
  it("returns zeros for no domains", () => {
    expect(sumStatusBreakdowns([])).toEqual({
      total: 0,
      favorites: 0,
      byStatus: [],
    });
  });

  it("sums totals, favorites and per-bucket counts across domains", () => {
    const result = sumStatusBreakdowns([
      domain({
        domain: "MEDIA",
        total: 10,
        favorites: 2,
        byStatus: [
          { bucket: "DONE", count: 6 },
          { bucket: "PLANNED", count: 4 },
        ],
      }),
      domain({
        domain: "GAMES",
        total: 5,
        favorites: 1,
        byStatus: [{ bucket: "DONE", count: 5 }],
      }),
    ]);

    expect(result.total).toBe(15);
    expect(result.favorites).toBe(3);
    expect(result.byStatus).toEqual(
      expect.arrayContaining([
        { bucket: "DONE", count: 11 },
        { bucket: "PLANNED", count: 4 },
      ]),
    );
    expect(result.byStatus).toHaveLength(2);
  });
});
