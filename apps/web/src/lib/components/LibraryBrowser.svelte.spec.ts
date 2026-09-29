import { ApiError } from "$lib/api/core";
import { resolveApiError } from "$lib/api/errors";
import type {
  LibraryBulkActions,
  LibraryColumn,
  LibraryItemView,
} from "$lib/library-view";
import { m } from "$lib/paraglide/messages.js";
import { pileHeaderLabel } from "$lib/pile";
import { apiUrl, server } from "$lib/test/msw";
import { goto, visit } from "$lib/test/navigation.svelte";
import { renderWithQuery } from "$lib/test/render";
import { toast } from "$lib/toast.svelte";
import type { PileSummaryDto } from "@loomkeep/shared";
import { ErrorCode, type PagedResult } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryBrowser, {
  type LibraryLoadParams,
  type PileLoadParams,
} from "./LibraryBrowser.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

// happy-dom's IntersectionObserver never reports an intersection, so the
// infinite-scroll sentinel is driven by hand.
let intersect: (() => void) | null = null;
class FakeIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    intersect = () =>
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }

  disconnect() {
    intersect = null;
  }
}
vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

interface Entry {
  id: string;
  title: string;
  favorite?: boolean;
}

const card = createRawSnippet((entry: () => Entry) => ({
  render: () => `<p>${entry().title}</p>`,
}));

const itemView = (entry: Entry): LibraryItemView => ({
  href: `/app/books/${entry.id}`,
  title: entry.title,
  subtitle: null,
  imageUrl: null,
  status: { value: "READING", label: "Reading", cls: "" },
  ownership: "NONE",
  ownershipSource: null,
  reviewTarget: { type: "BOOK", id: "item" },
  rating: null,
  favorite: entry.favorite ?? false,
  progress: null,
});

const columns: LibraryColumn<Entry>[] = [
  { key: "title", kind: "title", label: "Titre", sort: "title" },
  {
    key: "notes",
    kind: "text",
    label: "Notes",
    defaultHidden: true,
    value: () => null,
  },
];

const pageOf = (
  items: Entry[],
  extra: Partial<PagedResult<Entry>> = {},
): PagedResult<Entry> => ({
  items,
  hasMore: false,
  total: items.length,
  ...extra,
});

const DUNE = { id: "1", title: "Dune" };
const HYPERION = { id: "2", title: "Hyperion" };

function renderBrowser(
  load: (params: LibraryLoadParams) => Promise<PagedResult<Entry>>,
  loadPile?: (params: PileLoadParams) => Promise<PileSummaryDto>,
  bulk?: LibraryBulkActions,
  setFavorite: (entry: Entry, next: boolean) => Promise<unknown> = vi.fn(
    async () => undefined,
  ),
) {
  return renderWithQuery(LibraryBrowser, {
    loadPile,
    bulk,
    setFavorite,
    icon: "book",
    title: "Books",
    subtitle: (count: number) => `${count} books`,
    noun: "livre",
    domain: "BOOKS",
    load,
    keyOf: (entry: Entry) => entry.id,
    statusOptions: [
      { label: "Reading", value: "READING" },
      { label: "Read", value: "READ" },
    ],
    sorts: [
      { label: "Added", value: "addedAt" },
      { label: "Title", value: "title" },
    ],
    defaultSort: "addedAt",
    card,
    itemView,
    columns,
  } as never);
}

const lastLoad = (load: ReturnType<typeof vi.fn>) =>
  load.mock.lastCall?.[0] as LibraryLoadParams;

beforeEach(() => {
  localStorage.clear();
  visit("/app/books");
  server.use(
    http.get(apiUrl("/saved-views"), () => HttpResponse.json([])),
    http.get(apiUrl("/lists/editable"), () => HttpResponse.json([])),
  );
});

describe("LibraryBrowser", () => {
  function bulkActions(): LibraryBulkActions & {
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  } {
    return {
      statusOptions: [{ label: "Read", value: "READ" }],
      ownershipOptions: [{ label: "Physical", value: "PHYSICAL" }],
      ownershipSources: {},
      update: vi.fn(async () => ({ updated: 1, skipped: 0 })),
      remove: vi.fn(async () => ({ updated: 1, skipped: 0 })),
    };
  }

  async function startSelecting(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole("button", { name: new RegExp(m.library_display()) }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.library_select_start() }),
    );
  }

  it("shows a hidden column picked in the display menu, remembered for this library", async () => {
    const user = userEvent.setup();
    localStorage.setItem("lk-library-view-books", "table");
    renderBrowser(
      vi.fn(async () => pageOf([DUNE])),
      undefined,
      bulkActions(),
    );
    await screen.findByRole("table");
    expect(screen.queryByRole("columnheader", { name: "Notes" })).toBeNull();

    await user.click(
      screen.getByRole("button", { name: new RegExp(m.library_display()) }),
    );
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Notes" }));

    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeTruthy();
    expect(localStorage.getItem("lk-library-columns-books")).toBe(
      JSON.stringify(["title", "notes"]),
    );

    await user.click(
      screen.getByRole("menuitem", { name: m.library_columns_reset() }),
    );
    expect(screen.queryByRole("columnheader", { name: "Notes" })).toBeNull();
    expect(localStorage.getItem("lk-library-columns-books")).toBeNull();
  });

  it("shows a favorite toggled from the table at once, and saves it", async () => {
    const user = userEvent.setup();
    const setFavorite = vi.fn(async () => undefined);
    localStorage.setItem("lk-library-view-books", "table");
    renderBrowser(
      vi.fn(async () => pageOf([{ ...DUNE, favorite: false }])),
      undefined,
      undefined,
      setFavorite,
    );
    await screen.findByRole("table");

    await user.click(
      screen.getByRole("button", { name: m.common_favorite_add() }),
    );

    expect(
      screen.getByRole("button", { name: m.common_favorite_remove() }),
    ).toBeTruthy();
    expect(setFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1" }),
      true,
    );
  });

  it("applies a bulk action to exactly the picked entries", async () => {
    const user = userEvent.setup();
    const bulk = bulkActions();
    renderBrowser(
      vi.fn(async () => pageOf([DUNE, HYPERION])),
      undefined,
      bulk,
    );
    await screen.findByText("Dune");

    await startSelecting(user);
    await user.click(screen.getByRole("button", { name: "Hyperion" }));
    expect(
      screen.getByText(m.library_bulk_count_one({ count: 1 })),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: m.common_favorite() }));
    await user.click(
      screen.getByRole("menuitem", { name: m.common_favorite_add() }),
    );

    await waitFor(() =>
      expect(bulk.update).toHaveBeenCalledWith({ ids: ["2"], favorite: true }),
    );
  });

  it("targets the filters, not ids, once every matching entry is selected", async () => {
    const user = userEvent.setup();
    const bulk = bulkActions();
    visit("/app/books?status=READING");
    renderBrowser(
      vi.fn(async () => pageOf([DUNE, HYPERION], { hasMore: true, total: 42 })),
      undefined,
      bulk,
    );
    await screen.findByText("Dune");

    await startSelecting(user);
    await user.click(
      screen.getByRole("button", { name: m.common_select_all() }),
    );
    await user.click(
      screen.getByRole("button", {
        name: m.library_select_matching({ count: 42 }),
      }),
    );
    expect(
      screen.getByText(m.library_bulk_count_many({ count: 42 })),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: m.common_status() }));
    await user.click(screen.getByRole("menuitem", { name: "Read" }));

    await waitFor(() =>
      expect(bulk.update).toHaveBeenCalledWith({
        filters: expect.objectContaining({ statuses: ["READING"] }),
        status: "READ",
      }),
    );
  });

  it("moves between entries with J/K and the arrows of the mode's axis", async () => {
    const user = userEvent.setup();
    renderBrowser(
      vi.fn(async () => pageOf([DUNE, HYPERION])),
      undefined,
      bulkActions(),
    );
    await screen.findByText("Dune");
    await startSelecting(user);
    const focusedTitle = () =>
      document.activeElement?.getAttribute("aria-label");

    await user.keyboard("j");
    expect(focusedTitle()).toBe("Dune");
    await user.keyboard("{ArrowRight}");
    expect(focusedTitle()).toBe("Hyperion");
    // Cards are a grid: up/down keep their native meaning.
    await user.keyboard("{ArrowUp}");
    expect(focusedTitle()).toBe("Hyperion");
    await user.keyboard("k");
    expect(focusedTitle()).toBe("Dune");

    await user.keyboard("x");
    expect(
      screen.getByRole("button", { name: "Dune" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("hides removed entries until the undo delay, and undoing keeps them", async () => {
    const user = userEvent.setup();
    const bulk = bulkActions();
    renderBrowser(
      vi.fn(async () => pageOf([DUNE, HYPERION])),
      undefined,
      bulk,
    );
    await screen.findByText("Dune");

    await startSelecting(user);
    await user.click(screen.getByRole("button", { name: "Dune" }));
    await user.click(screen.getByRole("button", { name: m.common_remove() }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: m.common_remove() }),
    );

    await waitFor(() => expect(screen.queryByText("Dune")).toBeNull());
    expect(bulk.remove).not.toHaveBeenCalled();

    toast.items.at(-1)!.action!.run();

    expect(await screen.findByText("Dune")).toBeTruthy();
    expect(bulk.remove).not.toHaveBeenCalled();
  });

  it("renders the mode picked in the display menu, remembered for this library", async () => {
    const user = userEvent.setup();
    const load = vi.fn(async () => pageOf([DUNE, HYPERION]));
    renderBrowser(load);
    expect(await screen.findByText("Dune")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: new RegExp(m.library_display()) }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.library_view_table() }),
    );

    expect(await screen.findByRole("table")).toBeTruthy();
    expect(localStorage.getItem("lk-library-view-books")).toBe("table");

    await user.click(screen.getByRole("button", { name: "Titre" }));
    await waitFor(() =>
      expect(lastLoad(load)).toMatchObject({ sort: "title" }),
    );
  });

  it("shows the first page and the library's total", async () => {
    const load = vi.fn(async () =>
      pageOf([DUNE, HYPERION], { hasMore: true, total: 42 }),
    );
    renderBrowser(load);

    expect(await screen.findByText("Dune")).toBeTruthy();
    expect(screen.getByText("Hyperion")).toBeTruthy();
    expect(screen.getByText("42 books")).toBeTruthy();
    expect(lastLoad(load)).toMatchObject({
      query: "",
      statuses: [],
      favoritesOnly: false,
      sort: "addedAt",
      order: "desc",
      page: 1,
    });
  });

  it("adds what's left in the pile to the header, summed over the list's filters", async () => {
    const pile: PileSummaryDto = {
      unit: "PAGES",
      amount: 4812,
      entries: 63,
      counted: 59,
      estimated: false,
    };
    const loadPile = vi.fn(async () => pile);
    visit("/app/books?status=READING&fav=1&sort=title");
    renderBrowser(
      vi.fn(async () => pageOf([DUNE], { total: 63 })),
      loadPile,
    );

    expect(
      await screen.findByText(`63 books · ${pileHeaderLabel("BOOKS", pile)}`),
    ).toBeTruthy();
    // The filters, never the order or the page: a pile has neither.
    expect(loadPile).toHaveBeenLastCalledWith({
      query: "",
      statuses: ["READING"],
      favoritesOnly: true,
      extra: [],
    });
  });

  it("leaves the header alone when nothing in the pile can be counted", async () => {
    renderBrowser(
      vi.fn(async () => pageOf([DUNE], { total: 1 })),
      vi.fn(async () => ({
        unit: "PAGES" as const,
        amount: 0,
        entries: 3,
        counted: 0,
        estimated: false,
      })),
    );

    expect(await screen.findByText("1 books")).toBeTruthy();
  });

  it("loads the next page once the end of the grid is reached", async () => {
    const load = vi.fn(async ({ page }: LibraryLoadParams) =>
      page === 1
        ? pageOf([DUNE], { hasMore: true, total: 2 })
        : pageOf([HYPERION], { total: 2 }),
    );
    renderBrowser(load);
    await screen.findByText("Dune");

    intersect?.();

    expect(await screen.findByText("Hyperion")).toBeTruthy();
    expect(screen.getByText("Dune")).toBeTruthy();
    expect(lastLoad(load).page).toBe(2);
  });

  it("restores the filters a previous visit left in the address", async () => {
    visit("/app/books?q=dune&status=READ&fav=1&sort=title&order=asc");
    const load = vi.fn(async () => pageOf([DUNE]));
    renderBrowser(load);

    await screen.findByText("Dune");
    expect(lastLoad(load)).toMatchObject({
      query: "dune",
      statuses: ["READ"],
      favoritesOnly: true,
      sort: "title",
      order: "asc",
    });
  });

  it("refetches and keeps the address in sync when a filter changes", async () => {
    const load = vi.fn(async () => pageOf([DUNE]));
    renderBrowser(load);
    await screen.findByText("Dune");

    await userEvent.click(
      screen.getByRole("button", { name: m.common_favorites() }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: m.common_reverse_sort() }),
    );

    await waitFor(() =>
      expect(lastLoad(load)).toMatchObject({
        favoritesOnly: true,
        order: "asc",
        page: 1,
      }),
    );
    expect(goto).toHaveBeenLastCalledWith(
      "?fav=1&order=asc",
      expect.objectContaining({ replaceState: true }),
    );
  });

  // Regression for #182: syncing the address used to re-trigger itself,
  // navigating forever as soon as the page mounted.
  it("syncs the address once per change, not in a loop", async () => {
    const load = vi.fn(async () => pageOf([DUNE]));
    renderBrowser(load);
    await screen.findByText("Dune");

    await userEvent.click(
      screen.getByRole("button", { name: m.common_favorites() }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(goto.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("filters by status through the status picker", async () => {
    const load = vi.fn(async () => pageOf([DUNE]));
    renderBrowser(load);
    await screen.findByText("Dune");

    await userEvent.click(
      screen.getByRole("combobox", {
        name: m.common_selection_summary({
          label: m.common_status(),
          selection: m.common_all(),
        }),
      }),
    );
    await userEvent.click(screen.getByRole("option", { name: "Read" }));

    await waitFor(() => expect(lastLoad(load).statuses).toEqual(["READ"]));
  });

  it("searches only once typing settles", async () => {
    const load = vi.fn(async () => pageOf([DUNE]));
    renderBrowser(load);
    await screen.findByText("Dune");
    const callsBeforeTyping = load.mock.calls.length;

    await userEvent.type(
      screen.getByRole("searchbox", { name: m.library_filter_placeholder() }),
      "dune",
    );

    await waitFor(() => expect(lastLoad(load).query).toBe("dune"));
    // One fetch for the settled query, not one per keystroke.
    expect(load.mock.calls.length).toBe(callsBeforeTyping + 1);
  });

  it("invites to search the catalogue when the library is empty", async () => {
    renderBrowser(vi.fn(async () => pageOf([])));

    expect(
      await screen.findByText(m.library_empty_domain({ noun: "livre" })),
    ).toBeTruthy();
    const link = screen.getByRole("link", {
      name: m.library_search_noun({ noun: "livre" }),
    });
    expect(link.getAttribute("href")).toBe("/app/search?type=BOOKS");
  });

  it("offers to clear filters that match nothing", async () => {
    visit("/app/books?fav=1");
    const load = vi.fn(async ({ favoritesOnly }: LibraryLoadParams) =>
      favoritesOnly ? pageOf([]) : pageOf([DUNE]),
    );
    renderBrowser(load);

    expect(
      await screen.findByText(m.library_empty_filters({ noun: "livre" })),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: m.common_clear_filters() }),
    );

    expect(await screen.findByText("Dune")).toBeTruthy();
    expect(lastLoad(load).favoritesOnly).toBe(false);
  });

  it("shows a translated error when the library can't be loaded", async () => {
    const failure = new ApiError(0, "offline", ErrorCode.NetworkOffline);
    renderBrowser(vi.fn(async () => Promise.reject(failure)));

    expect(await screen.findByText(resolveApiError(failure))).toBeTruthy();
  });
});
