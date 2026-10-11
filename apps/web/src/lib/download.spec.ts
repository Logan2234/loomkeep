import { describe, expect, it } from "vitest";
import { datedFilename } from "./download";

describe("export filenames", () => {
  it("preserves UTC dates, prefixes and extensions", () => {
    const date = new Date("2026-10-11T00:30:00+02:00");
    expect(datedFilename("loomkeep-export-logan", "json", date)).toBe(
      "loomkeep-export-logan-2026-10-10.json",
    );
    expect(datedFilename("loomkeep-books", "csv", date)).toBe(
      "loomkeep-books-2026-10-10.csv",
    );
  });
});
