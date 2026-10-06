import { m } from "#lib/paraglide/messages.js";
import { page, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, within } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import MenuSheet from "./MenuSheet.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));
vi.mock("#lib/auth.svelte.js", () => ({ auth: { isAdmin: true } }));
vi.mock("#lib/config.svelte.js", () => ({
  appConfig: { socialEnabled: true, gamificationEnabled: true },
}));
vi.mock("#lib/reports-pending.svelte.js", () => ({
  useReportsPendingCount: () => ({ count: 12, available: true }),
}));

it("offers an overview destination and the pending reports badge in the admin menu", async () => {
  visit("/app/admin/users");
  renderWithQuery(MenuSheet, {});
  window.dispatchEvent(new Event("mobile-menu-toggle"));
  const menu = await screen.findByRole("dialog");
  expect(
    within(menu)
      .getByRole("link", { name: m.common_overview() })
      .getAttribute("href"),
  ).toBe("/app/admin");
  const reports = menu.querySelector(
    'a[href="/app/admin/reports"]',
  )! as HTMLElement;
  expect(within(reports).getByText("9+")).toBeTruthy();
  expect(page.url.pathname).toBe("/app/admin/users");
});
