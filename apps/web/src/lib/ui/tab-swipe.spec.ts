import { describe, expect, it } from "vitest";
import { adjacentTab, swipeStep } from "./tab-swipe";

describe("swipeStep", () => {
  it("goes to the next tab when sliding left, the previous when sliding right", () => {
    expect(swipeStep(-80, 5, 400)).toBe(1);
    expect(swipeStep(80, 5, 400)).toBe(-1);
  });

  it("takes a short flick but not a short slow drag", () => {
    expect(swipeStep(-40, 0, 50)).toBe(1);
    expect(swipeStep(-40, 0, 400)).toBe(0);
  });

  it("leaves a mostly vertical gesture to the page's scrolling", () => {
    expect(swipeStep(-80, 120, 200)).toBe(0);
  });
});

describe("adjacentTab", () => {
  const tabs = [{ value: "a" }, { value: "b", disabled: true }, { value: "c" }];

  it("skips a disabled tab", () => {
    expect(adjacentTab(tabs, "a", 1)).toBe("c");
    expect(adjacentTab(tabs, "c", -1)).toBe("a");
  });

  it("stops at the ends", () => {
    expect(adjacentTab(tabs, "a", -1)).toBeNull();
    expect(adjacentTab(tabs, "c", 1)).toBeNull();
  });
});
