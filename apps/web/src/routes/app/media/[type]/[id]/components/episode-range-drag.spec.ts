import { describe, expect, it } from "vitest";
import { autoScrollSpeed } from "./episode-range-drag";

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
