import { render } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import NavigationProgress from "./NavigationProgress.svelte";

const { navigating } = vi.hoisted(() => ({
  navigating: { to: null as object | null },
}));
vi.mock("$app/state", () => ({ navigating }));

const line = () => document.querySelector("[data-navigation-progress]");

it("stays away while no page change is under way", () => {
  navigating.to = null;
  render(NavigationProgress);
  expect(line()).toBeNull();
});

it("shows while a page change is under way", () => {
  navigating.to = { url: new URL("https://loomkeep.test/app/stats") };
  render(NavigationProgress);
  expect(line()).not.toBeNull();
});
