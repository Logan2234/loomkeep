import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { expect, it, vi } from "vitest";
import Wizard from "./Wizard.svelte";

const STEPS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
];

function renderFullscreen(activeIndex: number, canAdvance = true) {
  const handlers = {
    onBack: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
    onJump: vi.fn(),
  };
  render(Wizard, {
    steps: STEPS,
    activeIndex,
    canAdvance,
    fullscreen: true,
    nextLabel: "Get going",
    ...handlers,
    children: createRawSnippet(() => ({ render: () => "<p>Step body</p>" })),
  });
  return handlers;
}

it("shows one tab per step, filled up to the current one", () => {
  renderFullscreen(1);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "2",
  );
});

it("moves between steps with the arrow keys", async () => {
  const { onBack, onNext } = renderFullscreen(1);
  await fireEvent.keyDown(window, { key: "ArrowRight" });
  await fireEvent.keyDown(window, { key: "ArrowLeft" });
  expect(onNext).toHaveBeenCalledOnce();
  expect(onBack).toHaveBeenCalledOnce();
});

it("keeps finishing a deliberate tap, never a key or a swipe", async () => {
  const { onNext, onFinish } = renderFullscreen(2);
  await fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(onNext).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();
});

it("does not move forward while the step can't be left", async () => {
  const { onNext } = renderFullscreen(0, false);
  await fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(onNext).not.toHaveBeenCalled();
});

it("labels the main button with the step's own words", () => {
  renderFullscreen(0);
  expect(
    screen.getAllByRole("button", { name: "Get going" }).length,
  ).toBeGreaterThan(0);
});
