import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { CalendarEntryDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarPage from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
vi.mock("$app/navigation", () => import("$lib/test/navigation.svelte"));

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

describe("calendar page", () => {
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
