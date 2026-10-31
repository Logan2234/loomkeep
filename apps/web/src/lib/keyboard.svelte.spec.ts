import { afterEach, expect, it, vi } from "vitest";
import { keyboard } from "./keyboard.svelte";

const setHeight = (value: number) => {
  Object.defineProperty(window, "innerHeight", { value, configurable: true });
  window.dispatchEvent(new Event("resize"));
};

const flagged = () =>
  document.documentElement.classList.contains("keyboard-open");

let teardown: () => void;

afterEach(() => {
  teardown();
  document.body.replaceChildren();
  setHeight(800);
  vi.useRealTimers();
});

it("flags the page while the keyboard shrinks it, so the bottom bar's space goes too", () => {
  vi.useFakeTimers();
  setHeight(800);
  teardown = keyboard.init();
  const input = document.body.appendChild(document.createElement("input"));

  input.focus();
  setHeight(450);
  expect(flagged()).toBe(true);

  input.blur();
  setHeight(800);
  vi.runAllTimers();
  expect(flagged()).toBe(false);
});

it("drops the flag on teardown", () => {
  setHeight(800);
  teardown = keyboard.init();
  document.body.appendChild(document.createElement("input")).focus();
  setHeight(450);

  teardown();

  expect(flagged()).toBe(false);
});
