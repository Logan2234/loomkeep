import { m } from "$lib/paraglide/messages.js";
import { page, visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { screen, within } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import MenuSheet from "./MenuSheet.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));
vi.mock("$lib/auth.svelte", () => ({ auth: { isAdmin: true } }));
vi.mock("$lib/config.svelte", () => ({
  appConfig: { socialEnabled: true, gamificationEnabled: true },
}));
vi.mock("$lib/reports-pending.svelte", () => ({
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
