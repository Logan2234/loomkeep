import { auth } from "$lib/auth.svelte";
import { m } from "$lib/paraglide/messages";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { LibraryEntryDto, UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it } from "vitest";
import ToWatchWidget from "./ToWatchWidget.svelte";

beforeEach(() => {
  auth.user = { id: "u1" } as UserDto;
});

afterEach(() => {
  auth.user = null;
});

it("leaves out the films still to come", async () => {
  const upcoming = {
    id: "1",
    status: "PLANNED",
    updatedAt: "2026-10-01T00:00:00.000Z",
    lastWatchedAt: null,
    progress: null,
    mediaItem: {
      id: "m1",
      type: "MOVIE",
      title: "Avengers: Doomsday",
      posterUrl: null,
      canonicalSource: "TMDB",
      sourceId: "1",
      upcoming: true,
    },
  } as unknown as LibraryEntryDto;
  server.use(
    http.get(apiUrl("/library"), ({ request }) =>
      HttpResponse.json({
        items:
          new URL(request.url).searchParams.get("status") === "PLANNED"
            ? [upcoming]
            : [],
        hasMore: false,
      }),
    ),
  );

  renderWithQuery(ToWatchWidget, {
    widget: { id: "w1", type: "toWatch", x: 0, y: 0, w: 4, h: 2 },
    size: { width: 640, height: 320 },
  });

  expect(await screen.findByText(m.home_nothing_to_watch())).toBeTruthy();
  expect(screen.queryAllByText("Avengers: Doomsday")).toHaveLength(0);
});
