import { auth } from "$lib/auth.svelte";
import { m } from "$lib/paraglide/messages";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { LibraryEntryDto, UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it } from "vitest";
import TonightPickWidget from "./TonightPickWidget.svelte";

beforeEach(() => {
  auth.user = { id: "u1" } as UserDto;
});

afterEach(() => {
  auth.user = null;
});

const planned = (id: string, title: string, upcoming?: boolean) =>
  ({
    id,
    status: "PLANNED",
    mediaItem: {
      id: `m-${id}`,
      type: "MOVIE",
      title,
      posterUrl: null,
      canonicalSource: "TMDB",
      sourceId: id,
      ...(upcoming ? { upcoming } : {}),
    },
  }) as LibraryEntryDto;

it("never picks a film that isn't out yet", async () => {
  server.use(
    http.get(apiUrl("/library"), () =>
      HttpResponse.json({
        items: [planned("1", "Avengers: Doomsday", true)],
        hasMore: false,
      }),
    ),
  );

  renderWithQuery(TonightPickWidget, {
    widget: { id: "w1", type: "tonightPick", x: 0, y: 0, w: 2, h: 2 },
    size: { width: 400, height: 240 },
  });

  expect(await screen.findByText(m.home_tonight_pick_empty())).toBeTruthy();
  expect(screen.queryAllByText("Avengers: Doomsday")).toHaveLength(0);
});
