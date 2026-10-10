import { auth } from "#lib/auth.svelte.js";
import { appConfig } from "#lib/config.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MyReviewDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ReviewsPage from "./+page.svelte";

function review(
  id: string,
  title: string,
  targetType: MyReviewDto["targetType"],
  rating: number,
  createdAt: string,
  visibility: MyReviewDto["visibility"] = "FRIENDS",
): MyReviewDto {
  return {
    id,
    targetType,
    targetId: id,
    rating,
    text: null,
    visibility,
    spoilerTag: false,
    createdAt,
    updatedAt: createdAt,
    author: null,
    voteScore: 0,
    myVote: null,
    byFriend: false,
    target: { title, imageUrl: null, href: null },
  };
}

beforeEach(() => {
  appConfig.socialEnabled = true;
  server.use(
    http.get(apiUrl("/reviews/me"), () =>
      HttpResponse.json([
        review(
          "dune",
          "Dune : Deuxième partie",
          "MEDIA",
          9,
          "2026-10-02T00:00:00Z",
        ),
        review(
          "bg3",
          "Baldur's Gate 3",
          "GAME",
          10,
          "2026-09-21T00:00:00Z",
          "PUBLIC",
        ),
        review("oppen", "Oppenheimer", "MEDIA", 6, "2026-09-30T00:00:00Z"),
      ]),
    ),
  );
});

afterEach(() => {
  appConfig.socialEnabled = false;
  auth.user = null;
});

const titles = () =>
  screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".font-display")?.textContent?.trim());

describe("Reviews page", () => {
  it("sums up the reviews in the subtitle", async () => {
    renderWithQuery(ReviewsPage, {});

    expect(
      await screen.findByText(
        [
          m.reviews_count_other({ count: 3 }),
          m.reviews_page_average({
            average: (25 / 3).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            }),
          }),
          m.reviews_page_public({ count: 1 }),
        ].join(" · "),
      ),
    ).toBeTruthy();
  });

  it("searches, filters by domain and sorts by rating", async () => {
    renderWithQuery(ReviewsPage, {});
    const user = userEvent.setup();
    await screen.findByText("Oppenheimer");

    expect(titles()).toEqual([
      "Dune : Deuxième partie",
      "Oppenheimer",
      "Baldur's Gate 3",
    ]);

    await user.click(
      screen.getByRole("button", { name: m.reviews_sort_best() }),
    );
    expect(titles()).toEqual([
      "Baldur's Gate 3",
      "Dune : Deuxième partie",
      "Oppenheimer",
    ]);

    await user.click(screen.getByRole("button", { name: m.common_Media() }));
    expect(titles()).toEqual(["Dune : Deuxième partie", "Oppenheimer"]);

    await user.type(
      screen.getByRole("searchbox", { name: m.reviews_search() }),
      "oppen",
    );
    expect(titles()).toEqual(["Oppenheimer"]);
  });

  it("shows the bulk actions once a review is selected", async () => {
    renderWithQuery(ReviewsPage, {});
    const user = userEvent.setup();
    await screen.findByText("Oppenheimer");

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: m.common_select() }));
    await user.click(screen.getAllByRole("checkbox")[0]);

    const bar = await screen.findByRole("region", {
      name: m.reviews_selection_count({ count: 1 }),
    });
    await waitFor(() =>
      expect(
        within(bar).getByRole("button", { name: m.common_delete() }),
      ).toBeTruthy(),
    );
  });

  // Its page wouldn't open: the review stays, a warning stands in for the link.
  it("warns instead of linking to a work whose domain is off", async () => {
    auth.user = { enabledDomains: ["MEDIA"] } as unknown as UserDto;
    const linked = (r: MyReviewDto, href: string): MyReviewDto => ({
      ...r,
      target: { ...r.target!, href },
    });
    server.use(
      http.get(apiUrl("/reviews/me"), () =>
        HttpResponse.json([
          linked(
            review("dune", "Dune", "MEDIA", 9, "2026-10-02T00:00:00Z"),
            "/app/media/movie/1",
          ),
          linked(
            review(
              "bg3",
              "Baldur's Gate 3",
              "GAME",
              10,
              "2026-09-21T00:00:00Z",
            ),
            "/app/games/2",
          ),
        ]),
      ),
    );
    renderWithQuery(ReviewsPage, {});
    await screen.findByText("Baldur's Gate 3");

    expect(
      screen.getByRole("link", { name: /Dune/ }).getAttribute("href"),
    ).toBe("/app/media/movie/1");
    expect(screen.queryByRole("link", { name: /Baldur/ })).toBe(null);
    expect(
      screen.getByRole("img", {
        name: m.common_work_domain_off({ domain: m.common_Games() }),
      }),
    ).toBeTruthy();
  });
});
