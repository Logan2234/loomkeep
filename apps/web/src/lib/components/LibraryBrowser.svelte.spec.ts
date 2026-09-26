import { ApiError } from "$lib/api/core";
import { resolveApiError } from "$lib/api/errors";
import { m } from "$lib/paraglide/messages.js";
import { ErrorCode, type PagedResult } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiUrl, server } from "../../test/msw";
import { renderWithQuery } from "../../test/render";
import LibraryBrowser, {
  type LibraryLoadParams,
} from "./LibraryBrowser.svelte";

const nav = vi.hoisted(() => ({
  url: new URL("http://localhost/app/books"),
  goto: vi.fn(async () => {}),
}));
vi.mock("$app/state", () => ({
  page: {
    get url() {
      return nav.url;
    },
  },
}));
vi.mock("$app/navigation", () => ({ goto: nav.goto }));

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
}

const card = createRawSnippet((entry: () => Entry) => ({
  render: () => `<p>${entry().title}</p>`,
}));

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
) {
  return renderWithQuery(LibraryBrowser, {
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
  } as never);
}

const lastLoad = (load: ReturnType<typeof vi.fn>) =>
  load.mock.lastCall?.[0] as LibraryLoadParams;

beforeEach(() => {
  nav.url = new URL("http://localhost/app/books");
  nav.goto.mockClear();
  server.use(http.get(apiUrl("/saved-views"), () => HttpResponse.json([])));
});

describe("LibraryBrowser", () => {
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
    nav.url = new URL(
      "http://localhost/app/books?q=dune&status=READ&fav=1&sort=title&order=asc",
    );
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
    expect(nav.goto).toHaveBeenLastCalledWith(
      "?fav=1&order=asc",
      expect.objectContaining({ replaceState: true }),
    );
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
    nav.url = new URL("http://localhost/app/books?fav=1");
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
