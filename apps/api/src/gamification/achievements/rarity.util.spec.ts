import { toRarity } from "./rarity.util";

describe("toRarity", () => {
  it("says nothing on an instance too small for a share to mean anything", () => {
    expect(toRarity(3, 19)).toBeNull();
  });

  it("gives the share, with a decimal only under 10 %", () => {
    expect(toRarity(40, 1000)).toEqual({ percent: 4, upperBound: false });
    expect(toRarity(4, 1000)).toEqual({ percent: 0.4, upperBound: false });
    expect(toRarity(250, 1000)).toEqual({ percent: 25, upperBound: false });
    expect(toRarity(0, 50)).toEqual({ percent: 0, upperBound: false });
  });

  it("only gives an upper bound when so few hold it that they'd be singled out", () => {
    expect(toRarity(1, 40)).toEqual({ percent: 8, upperBound: true });
    expect(toRarity(2, 1000)).toEqual({ percent: 1, upperBound: true });
  });
});
