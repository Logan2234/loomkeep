import { computePossessionBreakdown } from "./possession.util";

describe("computePossessionBreakdown", () => {
  it("flags insufficient data for an empty library", () => {
    expect(computePossessionBreakdown([])).toEqual({
      sufficientData: false,
      renseignedRatio: 0,
    });
  });

  it("flags insufficient data below the 30% ratio", () => {
    // 2 renseigned out of 10 = 20%, below the floor.
    const statuses = ["PHYSICAL", "DIGITAL", ...Array<string>(8).fill("NONE")];

    const result = computePossessionBreakdown(statuses);
    expect(result).toEqual({ sufficientData: false, renseignedRatio: 0.2 });
  });

  it("returns a breakdown once the ratio meets the floor, excluding NONE", () => {
    // 3 renseigned out of 10 = 30%, meets the floor exactly.
    const statuses = [
      "PHYSICAL",
      "PHYSICAL",
      "DIGITAL",
      ...Array<string>(7).fill("NONE"),
    ];

    const result = computePossessionBreakdown(statuses);
    expect(result).toEqual({
      sufficientData: true,
      byStatus: expect.arrayContaining([
        { status: "PHYSICAL", count: 2 },
        { status: "DIGITAL", count: 1 },
      ]),
    });

    if (result.sufficientData) {
      expect(result.byStatus).toHaveLength(2);
    }
  });
});
