import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_COLOR } from "./theme.svelte";

describe("theme browser chrome", () => {
  it("keeps the runtime and initial metadata aligned with the CSS background tokens", () => {
    const css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
    const html = readFileSync(new URL("../app.html", import.meta.url), "utf8");
    const cssColors = {
      light: css.match(/:root\s*\{[\s\S]*?--bg:\s*(#[0-9a-f]{6})/i)?.[1],
      dark: css.match(/\.dark\s*\{[\s\S]*?--bg:\s*(#[0-9a-f]{6})/i)?.[1],
    };
    const bootColors = html.match(
      /content\s*=\s*dark\s*\?\s*"(#[0-9a-f]{6})"\s*:\s*"(#[0-9a-f]{6})"/i,
    );
    const initialColors = { light: bootColors?.[2], dark: bootColors?.[1] };

    expect(cssColors).toEqual(THEME_COLOR);
    expect(initialColors).toEqual(THEME_COLOR);
  });
});
