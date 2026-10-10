import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import {
  MAX_SESSION_DURATION_MINUTES,
  type BookEntryDto,
  type GameEntryDto,
} from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import BookSessionDock from "./BookSessionDock.svelte";
import GameSessionDock from "./GameSessionDock.svelte";

const common = {
  id: "entry",
  rating: null,
  notes: null,
  favorite: false,
  lastSessionAt: null,
  startedAt: null,
  finishedAt: null,
  createdAt: "2026-10-01T00:00:00Z",
  ownershipStatus: "NONE" as const,
  ownershipSource: null,
};
const game: GameEntryDto = {
  ...common,
  status: "PLAYING",
  playtimeMinutes: 0,
  trackedPlaytimeMinutes: 0,
  steamPlaytimeMinutes: null,
  steamSyncedAt: null,
  playthroughs: [],
  releaseAlertsEnabled: false,
  game: {
    id: "game",
    title: "Game",
    coverUrl: null,
    canonicalSource: "IGDB",
    sourceId: "1",
  },
};
const book: BookEntryDto = {
  ...common,
  status: "READING",
  currentPage: 0,
  editionKey: null,
  referencePageCount: null,
  trackedReadingMinutes: 0,
  readings: [],
  book: {
    id: "book",
    title: "Book",
    authors: [],
    coverUrl: null,
    pageCount: null,
    canonicalSource: "OPEN_LIBRARY",
    sourceId: "OL1W",
  },
};

describe("session timer confirmation", () => {
  it.each(["GAMES", "BOOKS"] as const)(
    "bounds the displayed duration for a long %s timer",
    async (domain) => {
      server.use(
        http.get(apiUrl("/session-timer"), () =>
          HttpResponse.json({
            id: "timer",
            domain,
            entryId: "entry",
            startedAt: "2026-10-01T00:00:00Z",
            pausedAt: "2026-10-08T00:00:00Z",
            elapsedSeconds: 600000,
          }),
        ),
        http.get(
          apiUrl(
            `/${domain === "GAMES" ? "games" : "books"}/entries/entry/sessions`,
          ),
          () =>
            HttpResponse.json({
              items: [],
              hasMore: false,
              totalSessions: 0,
              totalMinutes: 0,
              weekDays: [],
              activePlaythrough: null,
              activeReading: null,
            }),
        ),
      );
      if (domain === "GAMES")
        renderWithQuery(GameSessionDock, {
          entry: game,
          detailKey: ["detail"],
        });
      else
        renderWithQuery(BookSessionDock, {
          entry: book,
          detailKey: ["detail"],
        });
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: m.common_finish() }),
      );
      await waitFor(() =>
        expect(
          (
            screen.getByRole("textbox", {
              name: m.session_duration(),
            }) as HTMLInputElement
          ).value,
        ).toBe(String(MAX_SESSION_DURATION_MINUTES)),
      );
    },
  );
});
