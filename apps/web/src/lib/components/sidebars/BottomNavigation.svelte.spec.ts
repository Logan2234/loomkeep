import { auth } from "#lib/auth.svelte.js";
import { appConfig } from "#lib/config.svelte.js";
import { mobileNav } from "#lib/mobile-nav.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { fireEvent, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BottomNavigation from "./BottomNavigation.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

beforeEach(() => {
  auth.user = { enabledDomains: ["MEDIA", "GAMES"] } as UserDto;
});

afterEach(() => {
  auth.user = null;
});

// The bar used to leave out what's gated on the instance's social features,
// though the settings offered them: picking Feed drew nothing.
it("shows a pinned Feed and Leaderboard where the instance has them", () => {
  visit("/app");
  Object.assign(appConfig, { socialEnabled: true, gamificationEnabled: true });
  mobileNav.shortcuts = ["feed", "leaderboard"];

  renderWithQuery(BottomNavigation, {});

  expect(screen.getByRole("link", { name: m.nav_feed() })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: m.gamification_leaderboard_title() }),
  ).toBeTruthy();
});

it("keeps Library at the centre, and neither Messages, Alerts nor Menu", () => {
  visit("/app");
  mobileNav.shortcuts = ["home", "search", "calendar", "profile"];

  const { container } = renderWithQuery(BottomNavigation, {});

  const tabs = Array.from(
    container.querySelectorAll(
      "nav > a, nav > button:not([aria-label='" + m.nav_open_menu() + "'])",
    ),
  );
  expect(tabs).toHaveLength(5);
  expect(tabs[2].getAttribute("aria-label")).toBe(m.nav_library_choose());
  expect(
    screen.queryByRole("link", { name: m.nav_notifications_short() }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: m.chat_title() })).toBeNull();
});

it("pulls the menu up after a finger swiping up the bar", async () => {
  visit("/app");
  mobileNav.shortcuts = ["home", "search", "calendar", "profile"];
  const pulls: (number | null)[] = [];
  const listen = (event: Event) =>
    pulls.push((event as CustomEvent<number | null>).detail);
  addEventListener("mobile-menu-pull", listen);

  renderWithQuery(BottomNavigation, {});
  const home = screen.getByRole("link", { name: m.common_home() });
  await fireEvent.pointerDown(home, {
    pointerId: 1,
    clientX: 40,
    clientY: 800,
  });
  await fireEvent.pointerMove(window, {
    pointerId: 1,
    clientX: 42,
    clientY: 700,
  });
  await fireEvent.pointerUp(window, {
    pointerId: 1,
    clientX: 42,
    clientY: 700,
  });

  removeEventListener("mobile-menu-pull", listen);
  expect(pulls).toEqual([100, null]);
});

it("opens the menu from its grabber", async () => {
  visit("/app");
  const toggled = vi.fn();
  addEventListener("mobile-menu-toggle", toggled);

  renderWithQuery(BottomNavigation, {});
  await fireEvent.click(
    screen.getByRole("button", { name: m.nav_open_menu() }),
  );

  removeEventListener("mobile-menu-toggle", toggled);
  expect(toggled).toHaveBeenCalledOnce();
});
