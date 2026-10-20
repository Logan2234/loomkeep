import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import QuickAddPanel from "./QuickAddPanel.svelte";

const LISTS = [
  { id: "list-sf", title: "Séries SF", itemCount: 3 },
  { id: "list-julie", title: "À voir avec Julie", itemCount: 1 },
];

function mediaDetail(type: "MOVIE" | "SERIES", entry: object | null = null) {
  return {
    source: "TMDB",
    sourceId: "95396",
    type,
    title: "Severance",
    year: 2022,
    posterUrl: null,
    entry,
  };
}

function withLists(membership: Record<string, string> = {}) {
  server.use(
    http.get(apiUrl("/lists/editable"), () => HttpResponse.json(LISTS)),
    http.get(apiUrl("/lists/me/membership"), () =>
      HttpResponse.json(membership),
    ),
  );
}

describe("QuickAddPanel", () => {
  it("does not offer seen for an upcoming movie", async () => {
    withLists();
    server.use(
      http.get(apiUrl("/media/movie/95396"), () =>
        HttpResponse.json({
          ...mediaDetail("MOVIE"),
          movieRelease: {
            upcoming: true,
            publicDate: "2099-01-01",
            localDate: null,
            localType: null,
            region: "FR",
          },
        }),
      ),
    );
    renderWithQuery(QuickAddPanel, {
      href: "/app/media/movie/95396",
      link: "https://www.themoviedb.org/movie/95396",
    });
    await screen.findByRole("button", { name: m.media_status_planned() });
    expect(
      screen.queryByRole("button", { name: m.quick_add_seen() }),
    ).toBeNull();
  });
  it("adds an untracked work to watch in one tap, and undoes it with its lists", async () => {
    let tracked = false;
    const calls: string[] = [];
    withLists();
    server.use(
      http.get(apiUrl("/media/movie/95396"), () =>
        HttpResponse.json(
          mediaDetail(
            "MOVIE",
            tracked
              ? {
                  id: "entry-1",
                  status: "PLANNED",
                  mediaItem: { id: "item-1" },
                }
              : null,
          ),
        ),
      ),
      http.put(apiUrl("/library"), async ({ request }) => {
        calls.push(`upsert ${JSON.stringify(await request.json())}`);
        tracked = true;
        return HttpResponse.json({
          id: "entry-1",
          status: "PLANNED",
          mediaItem: { id: "item-1" },
        });
      }),
      http.post(apiUrl("/lists/:id/items"), async ({ params, request }) => {
        calls.push(`list ${params.id} ${JSON.stringify(await request.json())}`);
        return HttpResponse.json({ id: "li-1" });
      }),
      http.delete(apiUrl("/lists/:id/items/:itemId"), ({ params }) => {
        calls.push(`unlist ${params.id} ${params.itemId}`);
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(apiUrl("/library/entries/:id"), ({ params }) => {
        calls.push(`remove ${params.id}`);
        tracked = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(QuickAddPanel, {
      href: "/app/media/movie/95396",
      link: "https://www.imdb.com/title/tt11280740/",
    });

    expect(
      (
        await screen.findByRole("button", { name: m.media_status_planned() })
      ).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.queryByRole("button", { name: m.library_status_in_progress() }),
    ).toBeNull();

    await user.click(
      screen.getByRole("combobox", {
        name: m.common_selection_summary({
          label: m.common_lists(),
          selection: m.quick_add_no_list(),
        }),
      }),
    );
    await user.click(screen.getByRole("option", { name: "Séries SF" }));
    await user.click(screen.getByRole("button", { name: m.library_add() }));

    expect(
      await screen.findByText(m.quick_add_done_title({ title: "Severance" })),
    ).toBeTruthy();
    expect(calls).toEqual([
      'upsert {"source":"TMDB","sourceId":"95396","type":"MOVIE","status":"PLANNED"}',
      'list list-sf {"targetType":"MEDIA","targetId":"item-1"}',
    ]);

    await user.click(screen.getByRole("button", { name: m.quick_add_undo() }));

    await waitFor(() =>
      expect(calls.slice(2)).toEqual(["unlist list-sf li-1", "remove entry-1"]),
    );
    expect(
      await screen.findByRole("button", { name: m.library_add() }),
    ).toBeTruthy();
  });

  it("marks a series seen through its aired episodes", async () => {
    const calls: string[] = [];
    withLists();
    server.use(
      http.get(apiUrl("/media/series/95396"), () =>
        HttpResponse.json(mediaDetail("SERIES")),
      ),
      http.put(apiUrl("/library"), async ({ request }) => {
        calls.push(`upsert ${JSON.stringify(await request.json())}`);
        return HttpResponse.json({
          id: "entry-1",
          status: "PLANNED",
          mediaItem: { id: "item-1" },
        });
      }),
      http.post(apiUrl("/library/entries/bulk"), async ({ request }) => {
        calls.push(`bulk ${JSON.stringify(await request.json())}`);
        return HttpResponse.json({ updated: 1, skipped: 0 });
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(QuickAddPanel, {
      href: "/app/media/series/95396",
      link: "https://www.themoviedb.org/tv/95396",
    });

    await user.click(
      await screen.findByRole("button", { name: m.quick_add_seen() }),
    );
    expect(screen.getByText(m.quick_add_series_seen_hint())).toBeTruthy();
    await user.click(screen.getByRole("button", { name: m.library_add() }));

    await waitFor(() =>
      expect(calls).toEqual([
        'upsert {"source":"TMDB","sourceId":"95396","type":"SERIES","status":"PLANNED"}',
        'bulk {"ids":["entry-1"],"status":"COMPLETED"}',
      ]),
    );
  });

  it("shows where a tracked book stands and saves only a change", async () => {
    const patches: unknown[] = [];
    withLists({ "list-sf": "li-9" });
    server.use(
      http.get(apiUrl("/books/open_library/OL893415W"), () =>
        HttpResponse.json({
          source: "OPEN_LIBRARY",
          sourceId: "OL893415W",
          title: "Dune",
          authors: ["Frank Herbert"],
          year: 1965,
          coverUrl: null,
          pageCount: 612,
          editionKey: null,
          entry: {
            id: "book-entry",
            status: "READING",
            currentPage: 214,
            referencePageCount: 612,
            book: { id: "book-item" },
          },
        }),
      ),
      http.patch(apiUrl("/books/entries/:id"), async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(QuickAddPanel, {
      href: "/app/books/OL893415W",
      link: "https://openlibrary.org/works/OL893415W",
    });

    expect(
      await screen.findByText(
        `${m.quick_add_tracked({ status: m.book_status_reading() })} · ${m.quick_add_book_progress({ page: 214, total: 612 })}`,
      ),
    ).toBeTruthy();
    const save = screen.getByRole<HTMLButtonElement>("button", {
      name: m.common_save(),
    });
    expect(save.disabled).toBe(true);

    await user.click(
      screen.getByRole("button", { name: m.book_status_read() }),
    );
    await user.click(save);

    expect(await screen.findByText(m.quick_add_saved_title())).toBeTruthy();
    expect(patches).toEqual([{ status: "READ" }]);
    expect(
      screen.queryByRole("button", { name: m.quick_add_undo() }),
    ).toBeNull();
  });
});
