import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type {
  LibrarySagaDto,
  LibrarySagasDto,
  SagaMemberDto,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import SagasView from "./SagasView.svelte";

const work = (
  sourceId: string,
  title: string,
  extra: Partial<SagaMemberDto> = {},
): SagaMemberDto => ({
  source: "TMDB",
  sourceId,
  type: "MOVIE",
  title,
  year: 2021,
  posterUrl: null,
  isAdult: false,
  releaseDate: "2021-09-15",
  format: null,
  episodes: null,
  upcoming: false,
  status: null,
  ...extra,
});

const saga = (
  title: string,
  members: SagaMemberDto[],
  next: SagaMemberDto | null,
): LibrarySagaDto => ({
  key: `TMDB:${title}`,
  title,
  members,
  next,
  seen: members.filter((x) => x.status === "COMPLETED").length,
  released: members.filter((x) => !x.upcoming).length,
  lastActivityAt: "2026-10-01T00:00:00.000Z",
  finishedAt: next ? null : "2026-09-20T00:00:00.000Z",
});

const dune2 = work("693134", "Dune : Deuxième partie");
const spiderVerse3 = work("911916", "Beyond the Spider-Verse", {
  upcoming: true,
  releaseDate: null,
});
const SAGAS: LibrarySagasDto = {
  inProgress: [
    saga(
      "Dune",
      [work("438631", "Dune", { status: "COMPLETED" }), dune2],
      dune2,
    ),
  ],
  waiting: [
    saga(
      "Spider-Verse",
      [
        work("324857", "Into the Spider-Verse", { status: "COMPLETED" }),
        spiderVerse3,
      ],
      spiderVerse3,
    ),
  ],
  finished: [
    saga(
      "Le Seigneur des anneaux",
      [
        work("120", "La Communauté de l'anneau", { status: "COMPLETED" }),
        work("121", "Les Deux Tours", { status: "DROPPED" }),
      ],
      null,
    ),
  ],
};

const modeSwitch = createRawSnippet(() => ({ render: () => "<span></span>" }));

function serve(sagas: LibrarySagasDto = SAGAS) {
  const requests: URL[] = [];
  server.use(
    http.get(apiUrl("/library/sagas"), ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(sagas);
    }),
  );
  return requests;
}

beforeEach(() => {
  layout.compact = false;
});

describe("SagasView", () => {
  it("splits the sagas in progress from the ones waiting on a sequel", async () => {
    serve();

    renderWithQuery(SagasView, { modeSwitch });

    const inProgress = await screen.findByRole("list", {
      name: m.media_sagas_in_progress(),
    });
    expect(within(inProgress).getByText("Dune")).toBeTruthy();
    expect(
      within(inProgress).getByText(
        m.media_sagas_next({ title: "Dune : Deuxième partie" }),
        { exact: false },
      ),
    ).toBeTruthy();

    const waiting = screen.getByRole("list", { name: m.media_sagas_waiting() });
    expect(within(waiting).getByText("Spider-Verse")).toBeTruthy();
    expect(within(waiting).getByText(m.media_saga_upcoming())).toBeTruthy();
  });

  it("keeps the finished sagas folded until asked for", async () => {
    serve();
    const user = userEvent.setup();

    renderWithQuery(SagasView, { modeSwitch });
    await screen.findByText("Dune");
    expect(screen.queryByText("Le Seigneur des anneaux")).toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: m.media_sagas_show_finished({ count: 1 }),
      }),
    );

    const finished = await screen.findByRole("list", {
      name: m.media_sagas_finished(),
    });
    expect(within(finished).getByText("Le Seigneur des anneaux")).toBeTruthy();
    expect(
      within(finished).queryByRole("button", { name: /À voir|To watch/ }),
    ).toBeNull();
  });

  it("offers no fold when no saga is finished", async () => {
    serve({ ...SAGAS, finished: [] });

    renderWithQuery(SagasView, { modeSwitch });
    await screen.findByText("Dune");

    expect(
      screen.queryByRole("button", {
        name: m.media_sagas_show_finished({ count: 0 }),
      }),
    ).toBeNull();
    // The filters panel's button aside, nothing folds.
    expect(
      screen
        .queryAllByRole("button", { expanded: false })
        .filter((button) => button.getAttribute("aria-haspopup") !== "dialog"),
    ).toEqual([]);
  });

  it("adds the next work of a saga to the watchlist", async () => {
    serve();
    let body: unknown = null;
    server.use(
      http.put(apiUrl("/library"), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "entry-1" });
      }),
    );
    const user = userEvent.setup();

    renderWithQuery(SagasView, { modeSwitch });

    await user.click(
      await screen.findByRole("button", {
        name: m.media_saga_add_label({ title: "Dune : Deuxième partie" }),
      }),
    );

    await waitFor(() =>
      expect(body).toEqual({
        source: "TMDB",
        sourceId: "693134",
        type: "MOVIE",
        status: "PLANNED",
      }),
    );
  });

  it("offers only the filters a saga can answer, in the filters panel", async () => {
    const requests = serve();
    const user = userEvent.setup();

    renderWithQuery(SagasView, { modeSwitch });
    await screen.findByText("Dune");

    expect(screen.queryByRole("group", { name: m.common_status() })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: new RegExp(m.common_filters()) }),
    );
    const panel = await screen.findByRole("dialog", {
      name: m.library_filters_title(),
    });
    expect(
      within(panel).queryByRole("switch", {
        name: m.library_favorites_only(),
      }),
    ).toBeNull();

    const typeGroup = within(panel).getByRole("group", {
      name: m.common_type(),
    });
    await user.click(
      within(typeGroup).getByRole("button", { name: m.media_anime() }),
    );

    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.getAll("type")).toEqual(["ANIME"]),
    );
  });

  it("searches from the header, beside the view switch", async () => {
    const requests = serve();
    const user = userEvent.setup();

    renderWithQuery(SagasView, { modeSwitch });
    await screen.findByText("Dune");

    await user.type(
      screen.getByRole("searchbox", { name: m.library_filter_placeholder() }),
      "dune",
    );

    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("q")).toBe("dune"),
    );
  });

  it("says so when the library has no saga going", async () => {
    serve({ inProgress: [], waiting: [], finished: [] });

    renderWithQuery(SagasView, { modeSwitch });

    expect(await screen.findByText(m.media_sagas_empty())).toBeTruthy();
  });
});
