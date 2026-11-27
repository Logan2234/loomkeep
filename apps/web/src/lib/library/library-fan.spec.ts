import { describe, expect, it } from "vitest";
import { fanHit, fanOrigin, fanPoints, fanRadius } from "./library-fan";

describe("the Library fan", () => {
  it.each([320, 360, 412])(
    "keeps six domains on a %ipx wide screen, above the tab",
    (width) => {
      const radius = fanRadius(width);
      const origin = fanOrigin(width / 2, width, radius);

      for (const point of fanPoints(6, radius)) {
        expect(origin + point.dx - 52).toBeGreaterThanOrEqual(0);
        expect(origin + point.dx + 52).toBeLessThanOrEqual(width);
        expect(point.dy).toBeLessThan(-20);
      }
    },
  );

  it("opens symmetrically, first domain on the left", () => {
    const points = fanPoints(4, 140);
    expect(points[0].dx).toBeLessThan(0);
    expect(points[3].dx).toBe(-points[0].dx);
    expect(points[1].dy).toBe(points[2].dy);
  });

  it("moves its centre in from a tab near an edge", () => {
    expect(fanOrigin(30, 400, 140)).toBeGreaterThan(30);
    expect(fanOrigin(200, 400, 140)).toBe(200);
  });

  it("picks the domain under the finger, and none between them", () => {
    const points = fanPoints(4, 140);
    const origin = { x: 200, y: 700 };
    const third = { x: 200 + points[2].dx, y: 700 + points[2].dy };
    expect(fanHit(points, origin, third)).toBe(2);
    expect(fanHit(points, origin, origin)).toBe(-1);
  });
});
