import { describe, expect, it } from "vitest";
import { isFlashTarget } from "./flash-anchor";

describe("isFlashTarget", () => {
  it("matches the row the fragment names", () => {
    expect(isFlashTarget("timezone", "#timezone")).toBe(true);
  });

  it("ignores a fragment naming another row", () => {
    expect(isFlashTarget("timezone", "#newsletter")).toBe(false);
  });

  // Rows outside the search index render with no anchor. Comparing those
  // directly against an empty fragment matched every one of them, so a plain
  // visit flashed the whole page.
  it("never matches a row that has no anchor", () => {
    expect(isFlashTarget("", "")).toBe(false);
    expect(isFlashTarget("", "#")).toBe(false);
  });

  it("does not match when there is no fragment at all", () => {
    expect(isFlashTarget("timezone", "")).toBe(false);
  });
});
