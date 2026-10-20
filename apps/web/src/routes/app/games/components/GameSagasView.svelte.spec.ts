import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type {
  GameSagaMemberDto,
  GameStatus,
  LibraryGameSagasDto,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import GameSagasView from "./GameSagasView.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const game = (
  sourceId: string,
  title: string,
  status: GameStatus | null = null,
  upcoming = false,
): GameSagaMemberDto => ({
  source: "IGDB",
  sourceId,
  title,
  year: upcoming ? null : 2015,
  coverUrl: null,
  isAdult: false,
  releaseDate: upcoming ? "2028-01-01" : "2015-05-19",
  releaseDatePrecision: upcoming ? "YEAR" : "DAY",
  upcoming,
  status,
});

const witcher2 = game("2", "The Witcher 2");
const witcher4 = game("4", "The Witcher IV", null, true);
const SAGAS: LibraryGameSagasDto = {
  inProgress: [
    {
      key: "IGDB:117",
      title: "The Witcher",
      members: [game("1", "The Witcher", "COMPLETED"), witcher2],
      next: witcher2,
      seen: 1,
      released: 2,
      lastActivityAt: "2026-10-01T00:00:00.000Z",
      finishedAt: null,
    },
  ],
  waiting: [
    {
      key: "IGDB:1",
      title: "Mass Effect",
      members: [game("10", "Mass Effect", "COMPLETED"), witcher4],
      next: witcher4,
      seen: 1,
      released: 1,
      lastActivityAt: "2026-10-01T00:00:00.000Z",
      finishedAt: "2026-09-01T00:00:00.000Z",
    },
  ],
  finished: [],
};

const modeSwitch = createRawSnippet(() => ({ render: () => "<span></span>" }));

describe("GameSagasView", () => {
  it("adds a series' next game to the backlog, and shows the one only announced as such", async () => {
    server.use(
      http.get(apiUrl("/games/sagas"), () => HttpResponse.json(SAGAS)),
    );
    let body: unknown = null;
    server.use(
      http.put(apiUrl("/games"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "entry-2" });
      }),
    );

    renderWithQuery(GameSagasView, { modeSwitch });

    const waiting = await screen.findByRole("list", {
      name: m.media_sagas_waiting(),
    });
    expect(within(waiting).getByText("Mass Effect")).toBeTruthy();
    expect(within(waiting).getByText(m.media_saga_upcoming())).toBeTruthy();
    expect(
      within(waiting).getByText(m.game_release_year({ year: 2028 }), {
        exact: false,
      }),
    ).toBeTruthy();

    await userEvent.setup().click(
      screen.getByRole("button", {
        name: m.game_saga_add_label({ title: "The Witcher 2" }),
      }),
    );
    await waitFor(() =>
      expect(body).toEqual({
        source: "IGDB",
        sourceId: "2",
        status: "BACKLOG",
      }),
    );
  });
});
