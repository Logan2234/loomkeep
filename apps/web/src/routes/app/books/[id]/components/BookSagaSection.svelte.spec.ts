import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type {
  BookSagaDto,
  BookSagaMemberDto,
  BookStatus,
} from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import BookSagaSection from "./BookSagaSection.svelte";

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
  authors: [],
  year: 1996 + position,
  coverUrl: null,
  isAdult: false,
  position,
  status,
});

// Volume 3 is missing from Open Library: numbers follow the series, not
// the list.
const SAGA: BookSagaDto = {
  key: "OL326110L",
  title: "Harry Potter",
  members: [
    volume("OL1W", "L'École des sorciers", 1, "READ"),
    volume("OL2W", "La Chambre des secrets", 2),
    volume("OL4W", "La Coupe de feu", 4),
  ],
};

describe("BookSagaSection", () => {
  it("numbers the volumes as the series does and counts the ones read", () => {
    renderWithQuery(BookSagaSection, {
      saga: SAGA,
      sagaKey: ["books", "saga", "OL326110L", true],
      sourceId: "OL2W",
      entryStatus: "READING",
    });

    expect(screen.getByRole("heading", { name: "Harry Potter" })).toBeTruthy();
    expect(screen.getByLabelText("04 · La Coupe de feu")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("/3")).toBeTruthy();
  });

  it("adds an untracked volume to the to-read list", async () => {
    let body: unknown = null;
    server.use(
      http.put(apiUrl("/books"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "entry-4" });
      }),
    );
    renderWithQuery(BookSagaSection, {
      saga: SAGA,
      sagaKey: ["books", "saga", "OL326110L", true],
      sourceId: "OL2W",
      entryStatus: "READING",
    });

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: m.book_saga_add_label({ title: "La Coupe de feu" }),
      }),
    );

    await waitFor(() =>
      expect(body).toEqual({
        source: "OPEN_LIBRARY",
        sourceId: "OL4W",
        status: "TO_READ",
      }),
    );
  });
});
