import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import type { Component } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BabelioPage from "./babelio/+page.svelte";
import GoodreadsPage from "./goodreads/+page.svelte";
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
    "TV Time",
    TvTimePage,
    m.settings_import_tvtime_intro(),
    `. ${m.settings_import_tvtime_hint()}`,
  ],
  [
    "Trakt",
    TraktPage,
    m.settings_import_trakt_intro(),
    ` ${m.settings_import_trakt_hint()}`,
  ],
  [
    "MyAnimeList",
    MyAnimeListPage,
    m.settings_import_myanimelist_intro(),
    `. ${m.settings_import_myanimelist_hint()}`,
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
});
