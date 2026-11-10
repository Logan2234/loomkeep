import { m } from "#lib/paraglide/messages.js";
import CreatorPeekHarness from "#lib/test/CreatorPeekHarness.svelte";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { CreatorWorkDto, PersonPageDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

vi.mock("$app/navigation", () => ({ afterNavigate: vi.fn() }));

const work = (
  sourceId: string,
  title: string,
  extra: Partial<CreatorWorkDto> = {},
): CreatorWorkDto => ({
  domain: "MEDIA",
  type: "MOVIE",
  sourceId,
  title,
  year: 2021,
  releaseDate: "2021-09-15",
  posterUrl: `https://image.tmdb.org/t/p/w342/${sourceId}.jpg`,
  isAdult: false,
  jobs: ["Director"],
  character: null,
  episodeCount: null,
  genreIds: [],
  upcoming: false,
  kind: "WORK",
  editionCount: null,
  series: null,
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
  imdbId: null,
  wikidataId: null,
  homepage: null,
  rareCount: 0,
  groups: [
    {
      key: "DIRECTING",
      works: [
        work("27205", "Sicario", { releaseDate: "2015-05-19" }),
        work("438631", "Dune"),
        work("99343", "Next Floor", { kind: "SHORT" }),
        work("1170608", "Dune : Troisième partie", { upcoming: true }),
      ],
    },
  ],
};

describe("CreatorPeek", () => {
  it("opens after a steady hover, with who they are and what they're known for", async () => {
    let requests = 0;
    server.use(
      http.get(apiUrl("/creators/tmdb/person/137427"), () => {
        requests++;
        return HttpResponse.json(villeneuve);
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(CreatorPeekHarness, {});

    await user.hover(screen.getByRole("link", { name: "Denis Villeneuve" }));
    // The page is fetched during the wait, before anything shows.
    await waitFor(() => expect(requests).toBe(1));
    expect(screen.queryByRole("dialog")).toBeNull();

    const peek = await screen.findByRole(
      "dialog",
      { name: "Denis Villeneuve" },
      { timeout: 1500 },
    );
    expect(
      within(peek).getByText("1967 · Bécancour, Québec, Canada"),
    ).toBeTruthy();
    expect(within(peek).getByText("Cinéaste québécois.")).toBeTruthy();
    // Released works only, newest first.
    expect(
      within(peek)
        .getAllByRole("listitem")
        .map((li) => li.querySelector("a")?.getAttribute("aria-label")),
    ).toEqual(["Dune", "Sicario"]);
    expect(
      within(peek)
        .getByRole("link", { name: m.creator_see_page() })
        .getAttribute("href"),
    ).toBe("/app/people/tmdb/137427");
  });
});
