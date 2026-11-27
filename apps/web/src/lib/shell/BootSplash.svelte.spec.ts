import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import BootSplash from "./BootSplash.svelte";

const { native } = vi.hoisted(() => ({ native: { platform: false } }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.platform },
}));

const wordmark = () => screen.queryByText(m.common_KEEP());

it("shows the wordmark in a browser", () => {
  native.platform = false;
  render(BootSplash);
  expect(wordmark()).not.toBeNull();
});

it("continues the launch screen's mark in the Android app", () => {
  native.platform = true;
  render(BootSplash);
  expect(wordmark()).toBeNull();
  expect(screen.getByRole("status").textContent).toContain(m.common_loading());
});

it("keeps its message in the Android app, for the share target", () => {
  native.platform = true;
  render(BootSplash, { message: "Looking it up" });
  expect(screen.getByText("Looking it up")).toBeTruthy();
});
