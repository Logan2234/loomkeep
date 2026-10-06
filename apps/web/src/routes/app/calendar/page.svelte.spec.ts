import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { CalendarEntryDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CalendarPage from "./+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

function upcoming(
  entryId: string,
  title: string,
  episodeNumber: number,
  days: number,
  overrides: Partial<CalendarEntryDto> = {},
): CalendarEntryDto {
  return {
    mediaItem: {
      id: `media-${entryId}`,
      type: "SERIES",
      title,
      posterUrl: null,
      canonicalSource: "TMDB",
      sourceId: `src-${entryId}`,
    },
    game: null,
    entryId,
    episodeAlertsMuted: false,
    episodesBehind: 0,
    seasonNumber: 1,
    episodeNumber,
    episodeTitle: null,
    airDate: inDays(days),
    ...overrides,
  };
}

function serveCalendar(entries: CalendarEntryDto[]) {
  server.use(
    http.get(apiUrl("/library/calendar"), () => HttpResponse.json(entries)),
  );
}

let patched: { id: string; body: unknown }[];

beforeEach(() => {
  patched = [];
  server.use(
    http.get(apiUrl("/ee/status"), () => HttpResponse.json({ active: true })),
    http.get(apiUrl("/library/calendar"), () =>
      HttpResponse.json([
        upcoming("e1", "Lanterns", 7, 1),
        upcoming("e2", "Futurama", 10, 1),
        upcoming("e1", "Lanterns", 8, 8),
      ]),
    ),
    http.patch(apiUrl("/library/entries/:id"), async ({ request, params }) => {
      patched.push({ id: String(params.id), body: await request.json() });
      return HttpResponse.json({});
    }),
  );
});

afterEach(() => {
  auth.user = null;
});

describe("calendar page", () => {
  it("shows a movie release and toggles its opt-in instead of episode muting", async () => {
    serveCalendar([
      upcoming("movie-1", "Future movie", 0, 1, {
        mediaItem: {
          id: "m1",
          type: "MOVIE",
          title: "Future movie",
          posterUrl: null,
          canonicalSource: "TMDB",
          sourceId: "1",
        },
        seasonNumber: null,
        episodeNumber: null,
        episodeAlertsMuted: true,
        releaseRegion: "FR",
        releaseType: "cinema",
      }),
    ]);
    renderWithQuery(CalendarPage, {});
    const button = await screen.findByRole("button", {
      name: m.media_movie_reminder_enable(),
    });
    expect(screen.getByText(`${m.media_release_cinema()} · FR`)).toBeTruthy();
    expect(screen.queryByText("SnullEnull")).toBeNull();
    await userEvent.setup().click(button);
    await waitFor(() =>
      expect(patched).toEqual([
        { id: "movie-1", body: { movieReleaseAlertsEnabled: true } },
      ]),
    );
    expect(
      await screen.findByRole("button", {
        name: m.media_movie_reminder_cancel(),
      }),
    ).toBeTruthy();
  });
  it("lists a game dated to a month and opts into its reminder on the game entry", async () => {
    const gamePatches: { id: string; body: unknown }[] = [];
    server.use(
      http.patch(apiUrl("/games/entries/:id"), async ({ request, params }) => {
        gamePatches.push({ id: String(params.id), body: await request.json() });
        return HttpResponse.json({});
      }),
    );
    serveCalendar([
      upcoming("game-1", "Kingdom Hearts IV", 0, 1, {
        mediaItem: null,
        game: {
          id: "g1",
          title: "Kingdom Hearts IV",
          coverUrl: null,
          canonicalSource: "IGDB",
          sourceId: "113112",
        },
        seasonNumber: null,
        episodeNumber: null,
        episodeAlertsMuted: true,
        releasePrecision: "MONTH",
      }),
    ]);
    renderWithQuery(CalendarPage, {});

    const button = await screen.findByRole("button", {
      name: m.media_movie_reminder_enable(),
    });
    expect(screen.getByText(m.calendar_game_this_month())).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Kingdom Hearts IV/ })
        .getAttribute("href"),
    ).toBe("/app/games/113112");
    await userEvent.setup().click(button);
    await waitFor(() =>
      expect(gamePatches).toEqual([
        { id: "game-1", body: { releaseAlertsEnabled: true } },
      ]),
    );
    expect(patched).toEqual([]);
  });

  it("greys the bells out while no release summary is on", async () => {
    auth.user = {
      id: "u1",
      notifyEmail: "DISABLED",
      notifyPush: "DISABLED",
    } as UserDto;
    renderWithQuery(CalendarPage, {});

    const bells = await screen.findAllByRole("button", {
      name: m.calendar_mute_series({ title: "Lanterns" }),
    });
    expect(bells.every((bell) => (bell as HTMLButtonElement).disabled)).toBe(
      true,
    );
  });

  it("mutes the whole series from any one of its episodes", async () => {
    renderWithQuery(CalendarPage, {});
    const user = userEvent.setup();

    const muteLanterns = await screen.findAllByRole("button", {
      name: m.calendar_mute_series({ title: "Lanterns" }),
    });
    expect(muteLanterns).toHaveLength(2);

    await user.click(muteLanterns[0]);

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", {
          name: m.calendar_unmute_series({ title: "Lanterns" }),
        }),
      ).toHaveLength(2),
    );
    expect(patched).toEqual([{ id: "e1", body: { episodeAlertsMuted: true } }]);
    // Another show's episode is left alone.
    expect(
      screen.getAllByRole("button", {
        name: m.calendar_mute_series({ title: "Futurama" }),
      }),
    ).toHaveLength(1);
  });

  it("shows today's episodes as the Ce soir cards, with the show's backlog", async () => {
    serveCalendar([
      upcoming("e1", "Lanterns", 7, 0, { episodesBehind: 3 }),
      upcoming("e2", "Futurama", 10, 1),
    ]);
    renderWithQuery(CalendarPage, {});

    expect(await screen.findByText(m.calendar_tonight())).toBeTruthy();
    expect(screen.getByText(m.calendar_behind({ count: 3 }))).toBeTruthy();
  });

  it("narrows the list with the filter tabs", async () => {
    serveCalendar([
      upcoming("e1", "Lanterns", 7, 1, { episodeAlertsMuted: true }),
      upcoming("e2", "Futurama", 10, 1),
    ]);
    renderWithQuery(CalendarPage, {});
    const user = userEvent.setup();

    await screen.findByRole("button", {
      name: m.calendar_mute_series({ title: "Futurama" }),
    });
    await user.click(
      screen.getByRole("tab", { name: `${m.calendar_alerts_muted()} (1)` }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: m.calendar_mute_series({ title: "Futurama" }),
        }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("button", {
        name: m.calendar_unmute_series({ title: "Lanterns" }),
      }),
    ).toBeTruthy();
  });
});
