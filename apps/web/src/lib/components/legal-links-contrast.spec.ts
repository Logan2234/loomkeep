import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../app.css", import.meta.url), "utf8");
const component = readFileSync(
  new URL("./LegalLinks.svelte", import.meta.url),
  "utf8",
);
const shaClass =
  component.match(/<span(?: class="([^"]*)")?>\(\{appConfig.gitSha\}\)/)?.[1] ??
  "";
const opacity = Number(shaClass.match(/opacity-(\d+)/)?.[1] ?? 100) / 100;

function channels(hex: string): number[] {
  return hex.match(/[\da-f]{2}/gi)!.map((channel) => parseInt(channel, 16));
}

function luminance(rgb: number[]): number {
  return rgb.reduce((total, channel, index) => {
    const value = channel / 255;
    const linear =
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

describe("legal footer contrast", () => {
  it.each([":root", ".dark"])(
    "keeps the commit identifier readable in %s",
    (selector) => {
      const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
      const token = (name: string) =>
        channels(
          block.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, "i"))![1],
        );
      const background = token("bg");
      const foreground = token("dim").map(
        (channel, index) =>
          channel * opacity + background[index] * (1 - opacity),
      );
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));

      expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
