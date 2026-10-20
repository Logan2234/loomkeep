import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { CalendarEntryDto, UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it } from "vitest";
import ThisWeekWidget from "./ThisWeekWidget.svelte";

beforeEach(() => {
  auth.user = { id: "u1" } as UserDto;
});

afterEach(() => {
  auth.user = null;
});

it("shows local movie releases alongside episode codes in the home calendar", async () => {
  const movie: CalendarEntryDto = {
    mediaItem: {
      id: "m1",
      type: "MOVIE",
      title: "Upcoming film",
      posterUrl: null,
      canonicalSource: "TMDB",
      sourceId: "1",
    },
    game: null,
    entryId: "e1",
    episodeAlertsMuted: true,
    episodesBehind: 0,
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: null,
    airDate: "2099-12-18T00:00:00.000Z",
    releaseRegion: "FR",
    releaseType: "cinema",
  };
  const episode: CalendarEntryDto = {
    ...movie,
    entryId: "e2",
    seasonNumber: 1,
    episodeNumber: 2,
    mediaItem: {
      ...movie.mediaItem!,
      id: "m2",
      type: "SERIES",
      title: "Upcoming episode",
      sourceId: "2",
    },
  };
  server.use(
    http.get(apiUrl("/library/calendar"), () =>
      HttpResponse.json([movie, episode]),
    ),
  );

  renderWithQuery(ThisWeekWidget, { size: { width: 640, height: 320 } });

  expect(
    await screen.findByText(`${m.media_release_cinema()} · FR`),
  ).toBeTruthy();
  expect(screen.getByText("S01E02")).toBeTruthy();
  expect(screen.queryByText("SnullEnull")).toBeNull();
});
