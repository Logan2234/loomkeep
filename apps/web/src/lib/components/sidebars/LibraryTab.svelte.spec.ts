import { auth } from "#lib/auth.svelte.js";
import { DOMAINS } from "#lib/constants/domains.js";
import { m } from "#lib/paraglide/messages.js";
import { goto, visit } from "#lib/test/navigation.svelte.js";
import { renderWithQuery } from "#lib/test/render.js";
import { Domain, type UserDto } from "@loomkeep/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import LibraryTab from "./LibraryTab.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const enable = (...domains: Domain[]) => {
  auth.user = { enabledDomains: domains } as unknown as UserDto;
};

afterEach(() => {
  auth.user = null;
});

it("fans the enabled domains out on a tap", async () => {
  enable(Domain.MEDIA, Domain.BOOKS, Domain.MUSIC);
  visit("/app");
  renderWithQuery(LibraryTab, {});

  const tab = screen.getByRole("button", { name: m.nav_library_choose() });
  await userEvent.setup().click(tab);

  const fan = await screen.findByRole("list", { name: m.common_libraries() });
  expect(
    within(fan)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/app/media", "/app/books", "/app/music"]);
  expect(tab.getAttribute("aria-expanded")).toBe("true");
});

it("wears the domain it's in, and still opens the fan to change it", async () => {
  enable(Domain.MEDIA, Domain.BOOKS);
  visit("/app/books/abc");
  renderWithQuery(LibraryTab, {});

  const tab = screen.getByRole("button", {
    name: m.nav_library_current({ domain: DOMAINS.BOOKS.label }),
  });
  expect(tab.textContent).toContain(DOMAINS.BOOKS.label);
  await userEvent.setup().click(tab);

  const books = await screen.findByRole("link", { name: DOMAINS.BOOKS.label });
  expect(books.getAttribute("aria-current")).toBe("page");
});

it("is the domain itself when only one is enabled", () => {
  enable(Domain.GAMES);
  visit("/app");
  renderWithQuery(LibraryTab, {});

  expect(
    screen
      .getByRole("link", { name: DOMAINS.GAMES.label })
      .getAttribute("href"),
  ).toBe("/app/games");
  expect(screen.queryByRole("button")).toBeNull();
});

it("opens the domain a drag from the tab lets go over", async () => {
  enable(Domain.MEDIA, Domain.BOOKS);
  visit("/app");
  renderWithQuery(LibraryTab, {});
  const tab = screen.getByRole("button", { name: m.nav_library_choose() });

  await fireEvent.pointerDown(tab, { pointerId: 1, clientX: 0, clientY: 0 });
  await fireEvent.pointerMove(tab, { pointerId: 1, clientX: 0, clientY: -40 });
  const books = await screen.findByRole("link", { name: DOMAINS.BOOKS.label });
  const { left, top } = books.style;
  await fireEvent.pointerMove(tab, {
    pointerId: 1,
    clientX: parseFloat(left),
    clientY: parseFloat(top),
  });
  await fireEvent.pointerUp(tab, {
    pointerId: 1,
    clientX: parseFloat(left),
    clientY: parseFloat(top),
  });

  await waitFor(() => expect(goto).toHaveBeenCalledWith("/app/books"));
});

it("closes the fan on Escape", async () => {
  enable(Domain.MEDIA, Domain.BOOKS);
  visit("/app");
  renderWithQuery(LibraryTab, {});
  const user = userEvent.setup();

  await user.click(
    screen.getByRole("button", { name: m.nav_library_choose() }),
  );
  await screen.findByRole("list", { name: m.common_libraries() });
  await user.keyboard("{Escape}");

  await waitFor(() =>
    expect(
      screen.queryByRole("list", { name: m.common_libraries() }),
    ).toBeNull(),
  );
});
