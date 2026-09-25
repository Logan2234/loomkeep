import { describe, expect, it, vi } from "vitest";
import { clearPreviousFlash, isFlashTarget } from "./flash-anchor";

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

  it("matches a bare fragment marker against nothing", () => {
    expect(isFlashTarget("timezone", "#")).toBe(false);
  });

  it("clears the previous row before flashing a new search result", () => {
    const previous = {
      classList: { remove: vi.fn() },
    } as unknown as HTMLElement;
    const next = {
      classList: { remove: vi.fn() },
    } as unknown as HTMLElement;

    expect(clearPreviousFlash(previous, next)).toBe(next);
    expect(previous.classList.remove).toHaveBeenCalledWith("setting-flash");
  });
});
