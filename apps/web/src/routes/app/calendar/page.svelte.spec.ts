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
    seasonNumber: 1,
    episodeNumber,
    episodeTitle: null,
    airDate: inDays(days),
  };
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
});
