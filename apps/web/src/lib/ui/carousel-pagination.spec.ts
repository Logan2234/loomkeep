import { describe, expect, it } from "vitest";
import {
  getAdjacentCarouselOffset,
  getCarouselDots,
  getCarouselPageIndex,
  getCarouselPageOffsets,
} from "./carousel-pagination";

describe("getCarouselDots", () => {
  const kinds = (count: number, index: number) =>
    getCarouselDots(count, index).map((d) => d.kind);

  it("draws one dot per page when they fit", () => {
    expect(kinds(4, 0)).toEqual(["dot", "dot", "dot", "dot"]);
  });

  it("never draws more than the limit", () => {
    expect(getCarouselDots(30, 15)).toHaveLength(5);
  });

  it("shows a chevron only toward the pages left", () => {
    expect(kinds(30, 0).at(-1)).toBe("more-after");
    expect(kinds(30, 0)[0]).toBe("dot");
    expect(kinds(30, 15)[0]).toBe("more-before");
    expect(kinds(30, 15).at(-1)).toBe("more-after");
  });

  it("turns the chevron back into a dot at the end", () => {
    expect(kinds(30, 29)).toEqual(["more-before", "dot", "dot", "dot", "dot"]);
    expect(getCarouselDots(30, 29).at(-1)?.page).toBe(29);
  });

  it("keeps the current page in the row", () => {
    for (let i = 0; i < 30; i++) {
      expect(getCarouselDots(30, i).map((d) => d.page)).toContain(i);
    }
  });
});

describe("carousel pagination", () => {
  it("includes a partial final page and clamps its offset", () => {
    expect(getCarouselPageOffsets(220, 100)).toEqual([0, 100, 120]);
  });

  it("collapses a residual page that is too close to the previous offset", () => {
    expect(getCarouselPageOffsets(201, 100)).toEqual([0, 101]);
    expect(getCarouselPageOffsets(105, 100)).toEqual([0]);
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
