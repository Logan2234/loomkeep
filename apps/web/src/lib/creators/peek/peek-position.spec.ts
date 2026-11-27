import { describe, expect, it } from "vitest";
import { peekPosition } from "./peek-position";

const viewport = { width: 1000, height: 700 };
const panel = { width: 336, height: 390 };

describe("peekPosition", () => {
  it("opens under the name when it fits", () => {
    expect(
      peekPosition({ top: 100, bottom: 120, left: 200 }, panel, viewport),
    ).toEqual({ top: 126, left: 200, above: false });
  });

  it("opens above a name low on screen, without covering it", () => {
    const pos = peekPosition(
      { top: 500, bottom: 600, left: 200 },
      panel,
      viewport,
    );

    expect(pos).toEqual({ top: 104, left: 200, above: true });
    expect(pos.top + panel.height).toBeLessThanOrEqual(500);
  });

  it("stays inside the window's right edge", () => {
    expect(
      peekPosition({ top: 100, bottom: 120, left: 900 }, panel, viewport).left,
    ).toBe(656);
  });
});
