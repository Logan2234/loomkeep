import { describe, expect, it } from "vitest";
import {
  getAdjacentCarouselOffset,
  getCarouselPageIndex,
  getCarouselPageOffsets,
} from "./carousel-pagination";

describe("carousel pagination", () => {
  it("includes a partial final page and clamps its offset", () => {
    expect(getCarouselPageOffsets(220, 100)).toEqual([0, 100, 120]);
  });

  it("collapses empty and non-scrollable strips to one page", () => {
    expect(getCarouselPageOffsets(0, 100)).toEqual([0]);
    expect(getCarouselPageOffsets(80, 100)).toEqual([0]);
  });

  it("selects the nearest page, including the clamped last page", () => {
    const offsets = getCarouselPageOffsets(220, 100);

    expect(getCarouselPageIndex(118, offsets)).toBe(2);
  });

  it("uses the same offsets for previous and next navigation", () => {
    expect(getAdjacentCarouselOffset(0, [0, 100, 120], 1)).toBe(100);
    expect(getAdjacentCarouselOffset(100, [0, 100, 120], 1)).toBe(120);
    expect(getAdjacentCarouselOffset(120, [0, 100, 120], -1)).toBe(100);
  });
});
