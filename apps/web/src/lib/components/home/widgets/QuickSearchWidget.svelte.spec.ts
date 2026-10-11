import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { goto, visit } from "#lib/test/navigation.svelte.js";
import type { UserDto } from "@loomkeep/shared";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import QuickSearchWidget from "./QuickSearchWidget.svelte";

vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

beforeEach(() => {
  visit("/app");
  auth.user = {
    id: "u1",
    enabledDomains: ["MEDIA", "GAMES"],
    domainOrder: ["GAMES", "MEDIA"],
  } as UserDto;
});

afterEach(() => {
  auth.user = null;
});

const size = { width: 800, height: 80 };

it("searches every domain at once unless one is picked", async () => {
  const user = userEvent.setup();
  render(QuickSearchWidget, { size });

  const buttons = screen
    .getAllByRole("button")
    .map((b) => b.getAttribute("title"));
  expect(buttons[0]).toBe(m.search_tab_all());

  await user.type(screen.getByRole("searchbox"), "dune{Enter}");
  expect(goto).toHaveBeenLastCalledWith("/app/search?query=dune");
});

it("opens a picked domain's own tab", async () => {
  const user = userEvent.setup();
  render(QuickSearchWidget, { size });

  await user.click(screen.getByRole("button", { name: m.common_Games() }));
  await user.type(screen.getByRole("searchbox"), "dune{Enter}");

  expect(goto).toHaveBeenLastCalledWith("/app/search?type=GAMES&query=dune");
});
