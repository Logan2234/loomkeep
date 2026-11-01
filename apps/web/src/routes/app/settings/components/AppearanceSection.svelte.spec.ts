import { auth } from "#lib/auth.svelte.js";
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
  mobileNav.shortcuts = ["home", "media", "games", "menu"];
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
    expect(mobileNav.shortcuts).toEqual(["media", "home", "games", "menu"]),
  );
  await user.keyboard("[Escape]");
  await waitFor(() => expect(client.isFetching()).toBe(0));
});

it("removes a shortcut without dragging and keeps the menu required", async () => {
  const { container, client } = renderWithQuery(AppearanceSection, {});
  const rows = container.querySelectorAll("#mobile-nav li");
  expect(
    (
      within(rows[3] as HTMLElement).getByRole("button", {
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
    expect(mobileNav.shortcuts).toEqual(["media", "games", "menu"]),
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
});
