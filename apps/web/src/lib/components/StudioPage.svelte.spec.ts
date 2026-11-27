import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { CreatorWorkDto, StudioPageDto } from "@loomkeep/shared/contracts";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import StudioPage from "./StudioPage.svelte";

vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const work = (
  sourceId: string,
  title: string,
  extra: Partial<CreatorWorkDto> = {},
): CreatorWorkDto => ({
  domain: "MEDIA",
  type: "MOVIE",
  sourceId,
  title,
  year: 2016,
  releaseDate: "2016-10-21",
  posterUrl: null,
  isAdult: false,
  jobs: [],
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

const a24: StudioPageDto = {
  source: "tmdb",
  kind: "COMPANY",
  id: "41077",
  name: "A24",
  logoUrl: null,
  description: null,
  headquarters: "New York City, New York",
  country: "US",
  homepage: "https://a24films.com",
  parent: null,
  movieCount: 177,
  seriesCount: 48,
  knownFor: [],
};

describe("StudioPage", () => {
  it("lists a company's films best known first, 20 at a time, with the viewer's status", async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(apiUrl("/creators/tmdb/company/41077"), () =>
        HttpResponse.json(a24),
      ),
      http.get(apiUrl("/creators/tmdb/company/41077/works"), ({ request }) => {
        const query = new URL(request.url).searchParams;
        requests.push(query);
        const page = Number(query.get("page"));
        return HttpResponse.json(
          page === 1
            ? {
                items: [
                  work("545611", "Everything Everywhere All at Once", {
                    status: "COMPLETED",
                  }),
                  work("376867", "Moonlight"),
                ],
                hasMore: true,
                total: 177,
              }
            : {
                items: [work("503919", "The Lighthouse")],
                hasMore: false,
                total: 177,
              },
        );
      }),
    );
    const user = userEvent.setup();
    renderWithQuery(StudioPage, {
      kind: "COMPANY",
      source: "tmdb",
      id: "41077",
    });

    expect(await screen.findByRole("heading", { name: "A24" })).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: `${m.media_movies()} · 177` }),
    ).toBeTruthy();
    expect(
      (await screen.findByRole("link", { name: "Moonlight" })).getAttribute(
        "href",
      ),
    ).toBe("/app/media/movie/376867");
    expect(requests[0].get("type")).toBe("MOVIE");
    expect(requests[0].get("order")).toBe("known");

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(m.creator_load_more({ shown: 2, total: 177 })),
      }),
    );

    expect(
      await screen.findByRole("link", { name: "The Lighthouse" }),
    ).toBeTruthy();
    expect(requests.at(-1)?.get("page")).toBe("2");
    expect(screen.queryByRole("button", { name: /177/ })).toBeNull();
  });

  it("shows a network's series without tabs", async () => {
    server.use(
      http.get(apiUrl("/creators/tmdb/network/49"), () =>
        HttpResponse.json({
          ...a24,
          kind: "NETWORK",
          id: "49",
          name: "HBO",
          movieCount: 0,
          seriesCount: 382,
        }),
      ),
      http.get(apiUrl("/creators/tmdb/network/49/works"), () =>
        HttpResponse.json({
          items: [work("1399", "Game of Thrones", { type: "SERIES" })],
          hasMore: false,
          total: 382,
        }),
      ),
    );
    renderWithQuery(StudioPage, { kind: "NETWORK", source: "tmdb", id: "49" });

    expect(
      await screen.findByRole("link", { name: "Game of Thrones" }),
    ).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(
      screen.getByText(m.creator_count_series({ count: 382 })),
    ).toBeTruthy();
  });
});
