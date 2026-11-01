import { appConfig } from "#lib/config.svelte.js";
import { mobileNav } from "#lib/mobile-nav.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import BottomNavigation from "./BottomNavigation.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

beforeEach(() => {
  server.use(
    http.get(apiUrl("/notifications/counts"), () =>
      HttpResponse.json({ unread: 0, unseen: 0 }),
    ),
    http.get(apiUrl("/social/requests"), () => HttpResponse.json([])),
    http.get(apiUrl("/chat/unread"), () =>
      HttpResponse.json({ count: 0, works: 0 }),
    ),
  );
});

// The bar used to leave out what's gated on the instance's social features,
// though the settings offered them: picking Feed drew nothing.
it("shows a pinned Feed and Leaderboard where the instance has them", () => {
  visit("/app");
  Object.assign(appConfig, { socialEnabled: true, gamificationEnabled: true });
  mobileNav.shortcuts = ["menu", "feed", "leaderboard"];

  renderWithQuery(BottomNavigation, {});

  expect(screen.getByRole("link", { name: m.nav_feed() })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: m.gamification_leaderboard_title() }),
  ).toBeTruthy();
});

it("draws Alerts like any other tab while on its page", () => {
  visit("/app/notifications");
  mobileNav.shortcuts = ["menu", "home", "alerts"];

  renderWithQuery(BottomNavigation, {});

  const alerts = screen.getByRole("link", { name: m.common_notifications() });
  expect(alerts.className).toContain("-translate-y-1.5");
  expect(alerts.querySelector("span")?.className).toContain("bg-accent");
});
