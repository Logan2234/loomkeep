import { describe, expect, it } from "vitest";
import { THEME_COLOR } from "./theme.svelte";

describe("theme browser chrome", () => {
  it("uses the shipped background tokens", () => {
    expect(THEME_COLOR).toEqual({ light: "#f7f5f3", dark: "#0c0d10" });
  });
});
