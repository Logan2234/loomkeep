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
    const initialColors = {
      light: html.match(
        /media="\(prefers-color-scheme: light\)"\s*content="(#[0-9a-f]{6})"/i,
      )?.[1],
      dark: html.match(
        /media="\(prefers-color-scheme: dark\)"\s*content="(#[0-9a-f]{6})"/i,
      )?.[1],
    };

    expect(cssColors).toEqual(THEME_COLOR);
    expect(initialColors).toEqual(THEME_COLOR);
  });
});
