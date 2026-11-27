import { describe, expect, it } from "vitest";
import { isKeyboardOpen } from "./keyboard.svelte";

describe("isKeyboardOpen", () => {
  it("sees the keyboard when a typing field lost the page a keyboard's height", () => {
    expect(isKeyboardOpen({ tallest: 800, height: 480, typing: true })).toBe(
      true,
    );
  });

  it("ignores a shrink while nothing is being typed (a resized window)", () => {
    expect(isKeyboardOpen({ tallest: 800, height: 480, typing: false })).toBe(
      false,
    );
  });

  it("ignores focus alone, as in a browser that overlays its keyboard", () => {
    expect(isKeyboardOpen({ tallest: 800, height: 800, typing: true })).toBe(
      false,
    );
  });

  it("ignores the few pixels a collapsing address bar takes back", () => {
    expect(isKeyboardOpen({ tallest: 800, height: 744, typing: true })).toBe(
      false,
    );
  });
});
