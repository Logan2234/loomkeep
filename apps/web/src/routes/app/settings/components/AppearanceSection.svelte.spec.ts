import { auth } from "#lib/auth.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { mobileNav } from "#lib/mobile-nav.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AppearanceSection from "./AppearanceSection.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

beforeEach(() => {
  layout.compact = true;
  mobileNav.shortcuts = ["home", "search", "calendar"];
  auth.user = {
    enabledDomains: ["MEDIA", "GAMES"],
    locale: "en",
  } as UserDto;
  server.use(
    http.get(apiUrl("/ee/status"), () => HttpResponse.json({ active: true })),
  );
});

afterEach(() => {
  auth.user = null;
});

it("reorders mobile shortcuts with a keyboard handle and saves their order", async () => {
  const { client } = renderWithQuery(AppearanceSection, {});
  const handle = screen.getAllByRole("button", { name: m.common_reorder() })[0];
  handle.focus();
  const user = userEvent.setup();
  await user.keyboard("[Space][ArrowDown]");
  await waitFor(() =>
    expect(mobileNav.shortcuts).toEqual(["search", "home", "calendar"]),
  );
  await user.keyboard("[Escape]");
  await waitFor(() => expect(client.isFetching()).toBe(0));
});

it("removes a shortcut without dragging and keeps Library at the centre", async () => {
  const { container, client } = renderWithQuery(AppearanceSection, {});
  const rows = container.querySelectorAll("#mobile-nav li");
  expect(rows[2].getAttribute("aria-label")).toBe(m.common_library());
  expect(
    (
      within(rows[2] as HTMLElement).getByRole("button", {
        name: m.common_remove(),
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await userEvent.setup().click(
    within(rows[0] as HTMLElement).getByRole("button", {
      name: m.common_remove(),
    }),
  );
  await waitFor(() =>
    expect(mobileNav.shortcuts).toEqual(["search", "calendar"]),
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
});

// The bar only exists on a phone, and is stored on it: a desktop has
// nothing to arrange.
it("leaves the bottom bar out on a desktop", () => {
  layout.compact = false;
  const { container } = renderWithQuery(AppearanceSection, {});

  expect(container.querySelector("#mobile-nav")).toBeNull();
  expect(
    screen.getByText(m.settings_nav_style_label(), { exact: false }),
  ).toBeTruthy();
});
