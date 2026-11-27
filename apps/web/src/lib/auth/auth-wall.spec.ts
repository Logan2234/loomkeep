import { describe, expect, it } from "vitest";
import { dealCovers } from "./auth-wall.js";

const covers = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

describe("dealCovers", () => {
  it("never shares a cover between two rows", () => {
    const rows = dealCovers(covers(60), 4, 16);
    const seen = rows.map((row) => new Set(row));
    for (let a = 0; a < seen.length; a++)
      for (let b = a + 1; b < seen.length; b++)
        expect([...seen[a]].filter((c) => seen[b].has(c))).toEqual([]);
  });

  // The row is drawn twice in a loop, so its last tile sits next to its first.
  it.each([60, 20, 12, 40, 33])(
    "never puts a cover next to itself with %i covers",
    (n) => {
      for (const row of dealCovers(covers(n), 4, 16)) {
        const looped = [...row, ...row];
        for (let i = 1; i < looped.length; i++)
          expect(looped[i]).not.toBe(looped[i - 1]);
      }
    },
  );

  it("fills at least the requested tiles per row", () => {
    for (const row of dealCovers(covers(12), 4, 16))
      expect(row.length).toBeGreaterThanOrEqual(16);
  });
});
