import { describe, expect, it } from "vitest";
import { ratingWord } from "./rating-words";

describe("ratingWord", () => {
  it("gives distinct words to both ends of the scale", () => {
    expect(ratingWord(0)).not.toBe(ratingWord(10));
  });

  it("rounds a legacy half-point to the nearest word", () => {
    expect(ratingWord(8.5)).toBe(ratingWord(9));
    expect(ratingWord(7.4)).toBe(ratingWord(7));
  });

  it("clamps values outside the scale instead of failing", () => {
    expect(ratingWord(-2)).toBe(ratingWord(0));
    expect(ratingWord(14)).toBe(ratingWord(10));
  });
});
