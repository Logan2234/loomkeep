import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { landHome, welcomeCelebration } from "./onboarding-celebration.svelte";

let animate: ReturnType<typeof vi.fn>;

function home() {
  const root = document.createElement("div");
  root.innerHTML =
    "<div data-welcome-land></div><div data-welcome-land></div><div></div>";
  return root;
}

beforeEach(() => {
  animate = vi.fn(() => ({ finished: Promise.resolve() }));
  Object.defineProperty(HTMLElement.prototype, "animate", {
    value: animate,
    configurable: true,
  });
});

afterEach(() => {
  welcomeCelebration.startedAt = 0;
  vi.useRealTimers();
});

it("leaves the home still on an ordinary visit", () => {
  landHome(home());
  expect(animate).not.toHaveBeenCalled();
});

it("lands each home card when the welcome tour has just ended", () => {
  welcomeCelebration.startedAt = Date.now();
  landHome(home());
  expect(animate).toHaveBeenCalledTimes(2);
});

it("doesn't replay the landing long after the tour", () => {
  vi.useFakeTimers();
  welcomeCelebration.startedAt = Date.now();
  vi.advanceTimersByTime(10_000);
  landHome(home());
  expect(animate).not.toHaveBeenCalled();
});
