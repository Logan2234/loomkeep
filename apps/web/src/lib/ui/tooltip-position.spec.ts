import { describe, expect, it } from "vitest";
import { computeTooltipPosition } from "./tooltip-position";

const viewport = { top: 0, left: 0, width: 320, height: 480 };

describe("computeTooltipPosition", () => {
  it("centers a tooltip above its trigger", () => {
    expect(
      computeTooltipPosition({
        trigger: { top: 200, right: 180, bottom: 240, left: 140 },
        tooltip: { width: 120, height: 40 },
        viewport,
        placement: "top",
      }),
    ).toEqual({ top: 152, left: 100, placement: "top" });
  });

  it("flips below a trigger when the preferred side does not fit", () => {
    expect(
      computeTooltipPosition({
        trigger: { top: 10, right: 180, bottom: 50, left: 140 },
        tooltip: { width: 120, height: 40 },
        viewport,
        placement: "top",
      }),
    ).toEqual({ top: 58, left: 100, placement: "bottom" });
  });

  it("clamps long content inside the visual viewport", () => {
    expect(
      computeTooltipPosition({
        trigger: { top: 200, right: 310, bottom: 240, left: 290 },
        tooltip: { width: 260, height: 60 },
        viewport: { top: 80, left: 20, width: 300, height: 400 },
        placement: "bottom",
      }),
    ).toEqual({ top: 248, left: 52, placement: "bottom" });
  });
});
