import type {
  LibraryColumn,
  LibraryInlineEdit,
  LibraryItemView,
} from "#lib/library-view.js";
import { m } from "#lib/paraglide/messages.js";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryTable from "./LibraryTable.svelte";

vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

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
  { key: "title", kind: "title", label: "Titre", sort: "title" },
  { key: "status", kind: "status", label: "Statut", sort: "status" },
  {
    key: "ownership",
    kind: "text",
    label: "Possession",
    value: (e) => e.owned,
  },
];

const EDITABLE_COLUMNS: LibraryColumn<Entry>[] = [
  ...COLUMNS.slice(0, 2),
  { key: "rating", kind: "rating", label: "Note", numeric: true },
  { ...COLUMNS[2], ownership: true } as LibraryColumn<Entry>,
];

function inlineEdit() {
  return {
    statusOptions: [
      { label: "En cours", value: "READING" },
      { label: "Lu", value: "READ" },
    ],
    ownershipOptions: [
      { label: "Aucune", value: "NONE" },
      { label: "Physique", value: "PHYSICAL" },
      { label: "Numérique", value: "DIGITAL" },
    ],
    ownershipSources: { DIGITAL: ["Steam", "GOG"] },
    save: vi.fn<LibraryInlineEdit<Entry>["save"]>(),
    saved: null,
    review: vi.fn<LibraryInlineEdit<Entry>["review"]>(),
  } satisfies LibraryInlineEdit<Entry>;
}

function renderTable(
  overrides: {
    sort?: string;
    reversed?: boolean;
    edit?: LibraryInlineEdit<Entry>;
    columns?: LibraryColumn<Entry>[];
  } = {},
) {
  const onSort = vi.fn();
  const onToggleFavorite = vi.fn();
  const itemView = (entry: Entry): LibraryItemView => ({
    href: `/app/media/series/${entry.id}`,
    title: entry.title,
    subtitle: "Série",
    imageUrl: null,
    status: { value: "READING", label: "En cours", cls: "" },
    ownership: "NONE",
    ownershipSource: null,
    reviewTarget: { type: "BOOK", id: "item" },
    rating: null,
    favorite: entry.favorite,
    progress: null,
  });
  render(LibraryTable<Entry>, {
    props: {
      items: ENTRIES,
      keyOf: (e) => e.id,
      itemView,
      columns: overrides.columns ?? COLUMNS,
      edit: overrides.edit,
      onToggleFavorite: (entry: Entry, next: boolean) =>
        onToggleFavorite(entry.id, next),
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

  it("changes a status in place from its menu, leaving the current one alone", async () => {
    const edit = inlineEdit();
    const { user } = renderTable({ edit, columns: EDITABLE_COLUMNS });

    await user.click(
      screen.getByRole("button", {
        name: m.library_edit_status({ title: "Severance" }),
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Lu" }));

    expect(edit.save).toHaveBeenCalledWith(ENTRIES[0], { status: "READ" });

    await user.click(
      screen.getByRole("button", {
        name: m.library_edit_status({ title: "Severance" }),
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "En cours" }));
    expect(edit.save).toHaveBeenCalledTimes(1);
  });

  it("changes the ownership in place from its menu", async () => {
    const edit = inlineEdit();
    const { user } = renderTable({ edit, columns: EDITABLE_COLUMNS });

    await user.click(
      screen.getByRole("button", {
        name: m.library_edit_ownership({ title: "Past Lives" }),
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Physique" }));

    expect(edit.save).toHaveBeenCalledWith(ENTRIES[1], {
      ownershipStatus: "PHYSICAL",
      ownershipSource: null,
    });
  });

  it("picks an ownership source from its status's submenu", async () => {
    const edit = inlineEdit();
    const { user } = renderTable({ edit, columns: EDITABLE_COLUMNS });

    await user.click(
      screen.getByRole("button", {
        name: m.library_edit_ownership({ title: "Past Lives" }),
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: /Numérique/ }));
    await user.click(screen.getByRole("menuitem", { name: "Steam" }));

    expect(edit.save).toHaveBeenCalledWith(ENTRIES[1], {
      ownershipStatus: "DIGITAL",
      ownershipSource: "Steam",
    });
  });

  it("opens the review form from an unrated row's +", async () => {
    const edit = inlineEdit();
    const { user } = renderTable({ edit, columns: EDITABLE_COLUMNS });

    await user.click(
      screen.getByRole("button", {
        name: m.library_rating_add({ title: "Past Lives" }),
      }),
    );

    expect(edit.review).toHaveBeenCalledWith(ENTRIES[1]);
  });
});
