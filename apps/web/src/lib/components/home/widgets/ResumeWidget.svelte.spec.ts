import { auth } from "#lib/auth.svelte.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/toast.svelte.js";
import type { LibraryEntryDto, UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

it("reports a failed resume instead of silently swallowing the error", async () => {
  const entry = pausedFor("Dark", 45);
  entry.progress = {
    nextEpisode: { episodeId: "ep1", seasonNumber: 1, episodeNumber: 2 },
    watchedEpisodes: 1,
    totalEpisodes: 3,
  } as LibraryEntryDto["progress"];
  server.use(
    http.get(apiUrl("/library"), () =>
      HttpResponse.json({ items: [entry], hasMore: false }),
    ),
    http.post(apiUrl("/library/episodes/ep1/watches"), () =>
      HttpResponse.json({ message: "Unavailable" }, { status: 503 }),
    ),
  );
  const error = vi.spyOn(toast, "error").mockImplementation(() => "");
  const { container } = renderWithQuery(ResumeWidget, {
    size: { width: 640, height: 320 },
  });
  await screen.findAllByText("Dark");
  await waitFor(() =>
    expect(container.querySelector("button.btn-primary")).not.toBeNull(),
  );
  await userEvent.click(
    container.querySelector<HTMLButtonElement>("button.btn-primary")!,
  );
  await waitFor(() => expect(error).toHaveBeenCalled());
  error.mockRestore();
});
