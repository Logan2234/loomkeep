import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { CreatorWorkDto, PersonPageDto } from "@loomkeep/shared";
import { screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import PersonPage from "./+page.svelte";

vi.mock("$app/state", () => ({
  page: {
    params: { source: "tmdb", id: "137427" },
    url: new URL("http://localhost/app/people/tmdb/137427"),
  },
}));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const work = (
  sourceId: string,
  title: string,
  extra: Partial<CreatorWorkDto> = {},
): CreatorWorkDto => ({
  type: "MOVIE",
  sourceId,
  title,
  year: 2021,
  releaseDate: "2021-09-15",
  posterUrl: null,
  isAdult: false,
  jobs: ["Director"],
  character: null,
  episodeCount: null,
  genreIds: [],
  upcoming: false,
  status: null,
  ...extra,
});

const villeneuve: PersonPageDto = {
  source: "tmdb",
  id: "137427",
  name: "Denis Villeneuve",
  photoUrl: null,
  description: "Cinéaste québécois.",
  birthday: "1967-10-03",
  deathday: null,
  placeOfBirth: "Bécancour, Québec, Canada",
  knownFor: "DIRECTING",
  alsoKnownAs: [],
  imdbId: "nm0898288",
  wikidataId: null,
  homepage: null,
  groups: [
    {
      key: "DIRECTING",
      works: [
        work("438631", "Dune", { status: "COMPLETED" }),
        work("1170608", "Dune : Le Messie", {
          year: null,
          releaseDate: null,
          upcoming: true,
        }),
      ],
    },
    {
      key: "ACTING",
      works: [
        work("11", "Making of Dune", { jobs: [], character: "Self" }),
        work("99", "Talk Show", {
          type: "SERIES",
          jobs: [],
          character: "Himself",
          episodeCount: 2,
        }),
      ],
    },
  ],
};

function servePerson(person: PersonPageDto) {
  server.use(
    http.get(apiUrl("/creators/tmdb/person/137427"), () =>
      HttpResponse.json(person),
    ),
  );
}

describe("Person page", () => {
  it("shows who they are and the group they're best known for first", async () => {
    servePerson(villeneuve);

    renderWithQuery(PersonPage, {});

    expect(
      await screen.findByRole("heading", { name: "Denis Villeneuve" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        m.creator_known_for({ group: m.creator_group_directing() }),
      ),
    ).toBeTruthy();
    const tab = screen.getByRole("tab", { selected: true });
    expect(tab.textContent).toContain(m.creator_group_directing());
    // Newest first: the announcement leads, the tracked film carries its status.
    const links = screen.getAllByRole("link", { name: /Dune/ });
    expect(links.map((l) => l.getAttribute("aria-label"))).toEqual([
      "Dune : Le Messie",
      "Dune",
    ]);
    expect(links[1].getAttribute("href")).toBe("/app/media/movie/438631");
    expect(screen.getByText(m.media_saga_upcoming())).toBeTruthy();
  });

  it("lists appearances as oneself under Acting, and filters by type", async () => {
    servePerson(villeneuve);
    const user = userEvent.setup();
    renderWithQuery(PersonPage, {});

    await user.click(
      await screen.findByRole("tab", {
        name: new RegExp(m.creator_group_acting()),
      }),
    );

    expect(
      await screen.findByText(`2021 · ${m.creator_as_self()}`),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `2021 · ${m.creator_as_self()} · 2 ${m.media_episode_short()}`,
      ),
    ).toBeTruthy();

    const types = screen.getByRole("group", { name: m.creator_work_type() });
    await user.click(
      within(types).getByRole("button", { name: m.media_series_plural() }),
    );

    expect(screen.queryByRole("link", { name: "Making of Dune" })).toBeNull();
    expect(screen.getByRole("link", { name: "Talk Show" })).toBeTruthy();
  });

  it("narrows to the works in the viewer's library", async () => {
    servePerson(villeneuve);
    const user = userEvent.setup();
    renderWithQuery(PersonPage, {});

    await user.click(
      await screen.findByRole("button", { name: m.creator_in_library() }),
    );

    expect(screen.getByRole("link", { name: "Dune" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Dune : Le Messie" })).toBeNull();
  });
});
