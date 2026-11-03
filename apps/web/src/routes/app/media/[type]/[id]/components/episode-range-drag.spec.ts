import { describe, expect, it, vi } from "vitest";
import { autoScrollSpeed, scrollStep } from "./episode-range-drag";

describe("autoScrollSpeed", () => {
  it("stays still away from the edges", () => {
    expect(autoScrollSpeed(400, 100, 700)).toBe(0);
  });

  it("scrolls faster nearer an edge, up or down", () => {
    expect(autoScrollSpeed(160, 100, 700)).toBeLessThan(0);
    expect(autoScrollSpeed(105, 100, 700)).toBeLessThan(
      autoScrollSpeed(160, 100, 700),
    );
    expect(autoScrollSpeed(695, 100, 700)).toBeGreaterThan(
      autoScrollSpeed(640, 100, 700),
    );
  });
});

describe("scrollStep", () => {
  // The page scrolls smoothly: a smooth step every frame restarted before it
  // got anywhere, crawling until the finger lifted and the last one landed.
  it("moves the list at once, whatever the page's smooth scrolling", () => {
    const scroller = { scrollBy: vi.fn() };

    scrollStep(scroller, 40);

    expect(scroller.scrollBy).toHaveBeenCalledWith({
      top: 40,
      behavior: "instant",
    });
  });
});
