import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "./dialogFocus";

describe("dialogFocus", () => {
  it("wraps focus in both directions", () => {
    expect(nextFocusIndex(2, 3, false)).toBe(0);
    expect(nextFocusIndex(0, 3, true)).toBe(2);
  });

  it("enters the focus cycle at the correct edge", () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0);
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
  });
});
