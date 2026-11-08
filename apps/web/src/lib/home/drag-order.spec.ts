import { describe, expect, it } from "vitest";
import { dragShift, dropIndex } from "./drag-order";

const rows = [0, 60, 120, 180].map((top) => ({ top, height: 60 }));

describe("dropIndex", () => {
  it("stays put until the middle crosses a neighbour's middle", () => {
    expect(dropIndex(rows, 0, 30 + 29)).toBe(0);
    expect(dropIndex(rows, 0, 30 + 61)).toBe(1);
  });

  it("lands at the end or the start when dragged past every row", () => {
    expect(dropIndex(rows, 0, 400)).toBe(3);
    expect(dropIndex(rows, 3, -50)).toBe(0);
  });
});

describe("dragShift", () => {
  it("moves the rows passed downwards up by the dragged row's height", () => {
    expect([0, 1, 2, 3].map((i) => dragShift(i, 0, 2, 60))).toEqual([
      0, -60, -60, 0,
    ]);
  });

  it("moves the rows passed upwards down", () => {
    expect([0, 1, 2, 3].map((i) => dragShift(i, 3, 1, 60))).toEqual([
      0, 60, 60, 0,
    ]);
  });
});
