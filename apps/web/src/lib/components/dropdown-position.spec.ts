import { describe, expect, it } from "vitest";
import { computeDropdownPosition } from "./dropdown-position";

const viewport = { top: 0, left: 0, width: 390, height: 844 };

describe("computeDropdownPosition", () => {
  it("places a panel below its trigger when it fits", () => {
    expect(
      computeDropdownPosition({
        trigger: { top: 100, right: 180, bottom: 140, left: 80 },
        panel: { width: 200, height: 240 },
        viewport,
        placement: "bottom-start",
        bottomInset: 72,
      }),
    ).toEqual({
      top: 144,
      left: 80,
      maxWidth: 374,
      maxHeight: 240,
      originY: "top",
    });
  });

  it("flips above a trigger near the fixed bottom navigation", () => {
    expect(
      computeDropdownPosition({
        trigger: { top: 700, right: 360, bottom: 740, left: 300 },
        panel: { width: 240, height: 300 },
        viewport,
        placement: "bottom-end",
        bottomInset: 72,
      }),
    ).toEqual({
      top: 396,
      left: 120,
      maxWidth: 374,
      maxHeight: 300,
      originY: "bottom",
    });
  });

  it("clamps oversized panels to a short landscape viewport", () => {
    expect(
      computeDropdownPosition({
        trigger: { top: 160, right: 805, bottom: 200, left: 760 },
        panel: { width: 900, height: 600 },
        viewport: { top: 0, left: 0, width: 812, height: 375 },
        placement: "bottom-end",
        bottomInset: 72,
      }),
    ).toEqual({
      top: 8,
      left: 8,
      maxWidth: 796,
      maxHeight: 148,
      originY: "bottom",
    });
  });

  it("respects a visual viewport offset", () => {
    expect(
      computeDropdownPosition({
        trigger: { top: 220, right: 250, bottom: 260, left: 150 },
        panel: { width: 180, height: 180 },
        viewport: { top: 120, left: 10, width: 360, height: 500 },
        placement: "bottom-start",
        bottomInset: 8,
      }),
    ).toEqual({
      top: 264,
      left: 150,
      maxWidth: 344,
      maxHeight: 180,
      originY: "top",
    });
  });

  it("keeps long menus within the established 20rem height cap", () => {
    expect(
      computeDropdownPosition({
        trigger: { top: 100, right: 180, bottom: 140, left: 80 },
        panel: { width: 200, height: 900 },
        viewport: { top: 0, left: 0, width: 1200, height: 1000 },
        placement: "bottom-start",
        bottomInset: 8,
      }).maxHeight,
    ).toBe(320);
  });
});
