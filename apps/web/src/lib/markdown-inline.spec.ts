import { describe, expect, it } from "vitest";
import { inlineSegments } from "./markdown-inline";

describe("inlineSegments", () => {
  it("splits code and bold runs, code inside bold included", () => {
    expect(inlineSegments("**Rename `OMDB_KEY`.** Then restart.")).toEqual([
      { text: "Rename ", bold: true },
      { text: "OMDB_KEY", code: true, bold: true },
      { text: ".", bold: true },
      { text: " Then restart.", bold: false },
    ]);
  });

  it("leaves a lone backtick as text", () => {
    expect(inlineSegments("a ` b")).toEqual([{ text: "a ` b", bold: false }]);
  });
});
