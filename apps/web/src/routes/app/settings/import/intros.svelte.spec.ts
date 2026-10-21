import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import type { Component } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnilistPage from "./anilist/+page.svelte";
import BabelioPage from "./babelio/+page.svelte";
import GoodreadsPage from "./goodreads/+page.svelte";
import ImdbPage from "./imdb/+page.svelte";
import LetterboxdPage from "./letterboxd/+page.svelte";
import MyAnimeListPage from "./myanimelist/+page.svelte";
import StoryGraphPage from "./storygraph/+page.svelte";
import TraktPage from "./trakt/+page.svelte";
import TvTimePage from "./tvtime/+page.svelte";

vi.mock("#lib/realtime/socket.js", () => ({
  socket: { on: vi.fn(), off: vi.fn() },
  onRealtimeEvent: vi.fn(() => () => {}),
}));

beforeEach(() => {
  server.use(http.get(apiUrl("/import/quota"), () => HttpResponse.json({})));
});

// Each intro is a link to the source's export page followed by its hint,
// whole: no sentence stitched from fragments that say the same thing twice.
const INTROS: [string, Component, string, string][] = [
  [
    "Trakt",
    TraktPage,
    m.settings_import_trakt_intro(),
    ` ${m.settings_import_trakt_hint()}`,
  ],
  [
    "Letterboxd",
    LetterboxdPage,
    m.settings_import_letterboxd_intro(),
    `. ${m.settings_import_letterboxd_hint()}`,
  ],
  [
    "IMDb",
    ImdbPage,
    m.settings_import_imdb_intro(),
    `. ${m.settings_import_imdb_hint()}`,
  ],
  [
    "MyAnimeList",
    MyAnimeListPage,
    m.settings_import_myanimelist_intro(),
    `. ${m.settings_import_myanimelist_hint()}`,
  ],
  [
    "AniList",
    AnilistPage,
    m.settings_import_anilist_intro(),
    `. ${m.settings_import_anilist_hint()}`,
  ],
  [
    "StoryGraph",
    StoryGraphPage,
    m.settings_import_storygraph_intro(),
    ` ${m.settings_import_storygraph_hint()}`,
  ],
  [
    "Goodreads",
    GoodreadsPage,
    m.settings_import_goodreads_intro(),
    ` ${m.settings_import_goodreads_hint()}`,
  ],
  [
    "Babelio",
    BabelioPage,
    m.settings_import_babelio_intro(),
    ` ${m.settings_import_babelio_hint()} ${m.settings_import_babelio_limits()}`,
  ],
];

describe("import intros", () => {
  it.each(INTROS)(
    "%s reads as its link, then its hint",
    (_name, page, link, rest) => {
      renderWithQuery(page, {});

      const anchor = screen.getByRole("link", { name: link });
      const intro = anchor.parentElement!.textContent!.replace(/\s+/g, " ");

      expect(intro.trim()).toBe(`${link}${rest}`);
    },
  );

  // TV Time has shut down: its export page is gone, only the archive remains.
  it("TV Time says it has closed and links nowhere", () => {
    renderWithQuery(TvTimePage, {});

    expect(screen.getByText(m.settings_import_tvtime_hint())).toBeTruthy();
    expect(
      screen
        .queryAllByRole("link")
        .filter((a) => /tvtime/.test(a.getAttribute("href") ?? "")),
    ).toEqual([]);
  });
});
