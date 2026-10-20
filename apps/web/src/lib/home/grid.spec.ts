import { describe, expect, it } from "vitest";
import {
  bottomRow,
  compact,
  moveItem,
  resizeItem,
  stackOrder,
  type GridRect,
} from "./grid";

const rect = (id: string, x: number, y: number, w: number, h: number) => ({
  id,
  x,
  y,
  w,
  h,
});

const at = (items: GridRect[], id: string) => {
  const { x, y, w, h } = items.find((item) => item.id === id)!;
  return { x, y, w, h };
};

describe("compact", () => {
  it("lifts every widget until something stops it, closing holes", () => {
    const out = compact([rect("a", 0, 3, 4, 2), rect("b", 0, 9, 4, 2)]);

    expect(at(out, "a")).toMatchObject({ y: 0 });
    expect(at(out, "b")).toMatchObject({ y: 2 });
  });

  it("keeps side-by-side widgets on their own columns", () => {
    const out = compact([rect("main", 0, 0, 9, 6), rect("side", 9, 4, 3, 2)]);

    expect(at(out, "side")).toMatchObject({ x: 9, y: 0 });
  });

  it("pushes an overlapping widget below the one it covers", () => {
    const out = compact([rect("a", 0, 0, 6, 3), rect("b", 2, 1, 6, 2)]);

    expect(at(out, "b")).toMatchObject({ y: 3 });
  });

  it("returns the widgets in their input order", () => {
    const out = compact([rect("low", 0, 5, 3, 1), rect("high", 0, 0, 3, 1)]);

    expect(out.map((item) => item.id)).toEqual(["low", "high"]);
  });
});

describe("moveItem", () => {
  it("swaps two stacked widgets when the top one is dragged onto the other", () => {
    const layout = [rect("a", 0, 0, 6, 2), rect("b", 0, 2, 6, 2)];

    const out = moveItem(layout, "a", 0, 2, 12);

    expect(at(out, "b")).toMatchObject({ y: 0 });
    expect(at(out, "a")).toMatchObject({ y: 2 });
  });

  it("pushes the widgets under a widget dragged upwards", () => {
    const layout = [rect("a", 0, 0, 6, 2), rect("b", 0, 2, 6, 3)];

    const out = moveItem(layout, "b", 0, 0, 12);

    expect(at(out, "b")).toMatchObject({ y: 0 });
    expect(at(out, "a")).toMatchObject({ y: 3 });
  });

  it("cascades a push through every widget in the way", () => {
    const layout = [
      rect("a", 0, 0, 4, 2),
      rect("b", 0, 2, 4, 2),
      rect("c", 0, 4, 4, 2),
      rect("d", 4, 0, 4, 6),
    ];

    const out = moveItem(layout, "d", 0, 0, 12);

    expect(at(out, "d")).toMatchObject({ x: 0, y: 0 });
    expect(at(out, "a")).toMatchObject({ y: 6 });
    expect(at(out, "b")).toMatchObject({ y: 8 });
    expect(at(out, "c")).toMatchObject({ y: 10 });
  });

  it("keeps a dragged widget inside the grid", () => {
    const out = moveItem([rect("a", 0, 0, 4, 2)], "a", 10, -3, 12);

    expect(at(out, "a")).toMatchObject({ x: 8, y: 0 });
  });

  it("lets a widget dropped into empty space below rise back up", () => {
    const out = moveItem([rect("a", 0, 0, 4, 2)], "a", 0, 20, 12);

    expect(at(out, "a")).toMatchObject({ y: 0 });
  });
});

describe("resizeItem", () => {
  it("grows from the top-left corner and pushes what it now covers", () => {
    const layout = [rect("a", 0, 0, 4, 2), rect("b", 0, 2, 4, 2)];

    const out = resizeItem(layout, "a", 6, 4, 12);

    expect(at(out, "a")).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    expect(at(out, "b")).toMatchObject({ y: 4 });
  });

  it("stops at the right edge", () => {
    const out = resizeItem([rect("a", 8, 0, 2, 2)], "a", 9, 2, 12);

    expect(at(out, "a")).toMatchObject({ w: 4 });
  });

  it("lets the widgets underneath rise when it shrinks", () => {
    const layout = [rect("a", 0, 0, 4, 4), rect("b", 0, 4, 4, 2)];

    const out = resizeItem(layout, "a", 4, 2, 12);

    expect(at(out, "b")).toMatchObject({ y: 2 });
  });
});

describe("bottomRow", () => {
  it("is the first free row under every widget", () => {
    expect(bottomRow([rect("a", 0, 0, 4, 3), rect("b", 4, 1, 4, 5)])).toBe(6);
    expect(bottomRow([])).toBe(0);
  });
});

describe("stackOrder", () => {
  it("reads the grid top to bottom, then left to right", () => {
    const out = stackOrder([
      rect("side", 9, 0, 3, 5),
      rect("second", 0, 6, 9, 5),
      rect("main", 0, 0, 9, 6),
    ]);

    expect(out.map((item) => item.id)).toEqual(["main", "side", "second"]);
  });
});
