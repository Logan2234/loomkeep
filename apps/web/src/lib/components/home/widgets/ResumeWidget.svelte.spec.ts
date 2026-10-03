import { auth } from "$lib/auth.svelte";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { LibraryEntryDto, UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ResumeWidget from "./ResumeWidget.svelte";

const DAY_MS = 86_400_000;

const pausedFor = (title: string, days: number) =>
  ({
    id: title,
    status: "WATCHING",
    lastWatchedAt: new Date(Date.now() - days * DAY_MS).toISOString(),
    mediaItem: { title, type: "SERIES", sourceId: title, posterUrl: null },
    progress: null,
  }) as unknown as LibraryEntryDto;

beforeEach(() => {
  auth.user = { id: "u1" } as UserDto;
});

afterEach(() => {
  auth.user = null;
});

describe("ResumeWidget", () => {
  it("leaves the ghosts to the library and offers only the shows paused lately", async () => {
    server.use(
      http.get(apiUrl("/library"), () =>
        HttpResponse.json({
          items: [pausedFor("Dark", 45), pausedFor("Lost", 400)],
          hasMore: false,
        }),
      ),
    );

    renderWithQuery(ResumeWidget, { size: { width: 640, height: 320 } });

    expect((await screen.findAllByText("Dark")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Lost")).toHaveLength(0);
  });
});
