import type { LibraryColumn, LibraryItemView } from "$lib/library-view";
import { m } from "$lib/paraglide/messages.js";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryTable from "./LibraryTable.svelte";

vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

interface Entry {
  id: string;
  title: string;
  owned: string | null;
  favorite: boolean;
}

const ENTRIES: Entry[] = [
  { id: "a", title: "Severance", owned: "Streaming", favorite: true },
  { id: "b", title: "Past Lives", owned: null, favorite: false },
];

const COLUMNS: LibraryColumn<Entry>[] = [
  { kind: "title", label: "Titre", sort: "title" },
  { kind: "status", label: "Statut", sort: "status" },
  { kind: "text", label: "Possession", value: (e) => e.owned },
];

function renderTable(overrides: { sort?: string; reversed?: boolean } = {}) {
  const onSort = vi.fn();
  const onToggleFavorite = vi.fn();
  const itemView = (entry: Entry): LibraryItemView => ({
    href: `/app/media/series/${entry.id}`,
    title: entry.title,
    subtitle: "Série",
    imageUrl: null,
    status: { label: "En cours", cls: "" },
    rating: null,
    favorite: entry.favorite,
    onToggleFavorite: (next) => onToggleFavorite(entry.id, next),
    progress: null,
  });
  render(LibraryTable<Entry>, {
    props: {
      items: ENTRIES,
      keyOf: (e) => e.id,
      itemView,
      columns: COLUMNS,
      sort: overrides.sort ?? "title",
      reversed: overrides.reversed ?? false,
      onSort,
      selection: {
        active: false,
        has: () => false,
        toggle: () => {},
        allLoaded: false,
        someLoaded: false,
        toggleLoaded: () => {},
      },
    },
  });
  return { onSort, onToggleFavorite, user: userEvent.setup() };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LibraryTable", () => {
  it("renders one row per entry, with a dash for an empty text cell", () => {
    renderTable();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0]).getByRole("link", { name: "Severance" }),
    ).toBeTruthy();
    expect(within(rows[1]).getByText("—")).toBeTruthy();
  });

  it("marks the active sort and sorts from a column header", async () => {
    const { onSort, user } = renderTable({ sort: "title", reversed: true });

    const title = screen.getByRole("columnheader", { name: "Titre" });
    expect(title.getAttribute("aria-sort")).toBe("ascending");

    await user.click(screen.getByRole("button", { name: "Statut" }));
    expect(onSort).toHaveBeenCalledWith("status");
  });

  it("toggles an entry's favorite from its row", async () => {
    const { onToggleFavorite, user } = renderTable();

    await user.click(
      screen.getAllByRole("button", { name: m.common_favorite_add() })[0],
    );

    expect(onToggleFavorite).toHaveBeenCalledWith("b", true);
  });

  it("falls back to rows below the table breakpoint", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    renderTable();

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
