import { describe, expect, it } from "vitest";
import { countryShade } from "./country-map";

const percent = (shade: string) => Number(/(\d+)%/.exec(shade)?.[1]);

describe("countryShade", () => {
  it("gives the top country the full accent", () => {
    expect(percent(countryShade(112, 112))).toBe(100);
  });

  it("keeps a single title visible next to a far larger top", () => {
    expect(percent(countryShade(1, 112))).toBe(22);
  });

  it("separates the middle of the ranking on a log scale", () => {
    const shades = [3, 12, 40].map((v) => percent(countryShade(v, 112)));

    expect(new Set(shades).size).toBe(3);
    expect(shades).toEqual([...shades].sort((a, b) => a - b));
  });
});
