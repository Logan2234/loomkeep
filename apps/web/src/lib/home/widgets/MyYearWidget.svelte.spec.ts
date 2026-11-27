import { auth } from "#lib/auth/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared/contracts";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import MyYearWidget from "./MyYearWidget.svelte";

beforeEach(() => {
  auth.user = { id: "u1" } as UserDto;
});

describe("MyYearWidget", () => {
  it("shows one line per domain the API returns", async () => {
    server.use(
      http.get(apiUrl("/stats/my-year"), () =>
        HttpResponse.json({
          year: new Date().getFullYear(),
          video: { movies: 43, episodes: 612, minutes: 25080 },
          books: { read: 1, pages: 0 },
        }),
      ),
    );
    renderWithQuery(MyYearWidget, {});

    expect(await screen.findByText(m.home_my_year_movies_many())).toBeTruthy();
    expect(screen.getByText(m.home_my_year_books_one())).toBeTruthy();
    expect(screen.queryByText(m.home_my_year_games_many())).toBeNull();
    expect(
      screen.queryByText(m.home_my_year_books_detail({ pages: "0" })),
    ).toBeNull();
  });

  it("asks to turn a domain on when none is", async () => {
    server.use(
      http.get(apiUrl("/stats/my-year"), () =>
        HttpResponse.json({ year: new Date().getFullYear() }),
      ),
    );
    renderWithQuery(MyYearWidget, {});

    expect(await screen.findByText(m.home_my_year_empty())).toBeTruthy();
  });
});
