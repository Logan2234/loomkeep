import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type {
  BookSagaMemberDto,
  BookStatus,
  LibraryBookSagasDto,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import BookSagasView from "./BookSagasView.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

const volume = (
  sourceId: string,
  title: string,
  position: number,
  status: BookStatus | null = null,
): BookSagaMemberDto => ({
  source: "OPEN_LIBRARY",
  sourceId,
  title,
  authors: ["J.K. Rowling"],
  year: 1996 + position,
  coverUrl: null,
  isAdult: false,
  position,
  status,
});

const chamber = volume("OL2W", "La Chambre des secrets", 2);
const SAGAS: LibraryBookSagasDto = {
  inProgress: [
    {
      key: "OL326110L",
      title: "Harry Potter",
      members: [volume("OL1W", "L'École des sorciers", 1, "READ"), chamber],
      next: chamber,
      seen: 1,
      released: 2,
      lastActivityAt: "2026-10-01T00:00:00.000Z",
      finishedAt: "2026-09-30T00:00:00.000Z",
    },
  ],
  waiting: [],
  finished: [],
};

const modeSwitch = createRawSnippet(() => ({ render: () => "<span></span>" }));

describe("BookSagasView", () => {
  it("lists a started series with its next volume, and adds it to the to-read list", async () => {
    server.use(
      http.get(apiUrl("/books/sagas"), () => HttpResponse.json(SAGAS)),
    );
    let body: unknown = null;
    server.use(
      http.put(apiUrl("/books"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "entry-2" });
      }),
    );

    renderWithQuery(BookSagasView, { modeSwitch });

    const inProgress = await screen.findByRole("list", {
      name: m.media_sagas_in_progress(),
    });
    expect(within(inProgress).getByText("Harry Potter")).toBeTruthy();
    expect(
      within(inProgress).getByText(
        m.media_sagas_next({ title: "La Chambre des secrets" }),
        { exact: false },
      ),
    ).toBeTruthy();
    // Books are only catalogued once out: no type to filter on.
    expect(
      screen.queryByRole("combobox", { name: new RegExp(m.common_type()) }),
    ).toBeNull();

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: m.book_saga_add_label({ title: "La Chambre des secrets" }),
      }),
    );
    await waitFor(() =>
      expect(body).toEqual({
        source: "OPEN_LIBRARY",
        sourceId: "OL2W",
        status: "TO_READ",
      }),
    );
  });

  it("says so when no series is started", async () => {
    server.use(
      http.get(apiUrl("/books/sagas"), () =>
        HttpResponse.json({ inProgress: [], waiting: [], finished: [] }),
      ),
    );

    renderWithQuery(BookSagasView, { modeSwitch });

    expect(await screen.findByText(m.book_sagas_empty())).toBeTruthy();
  });
});
