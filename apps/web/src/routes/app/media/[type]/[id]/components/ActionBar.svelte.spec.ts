import { m } from "$lib/paraglide/messages";
import type { LibraryEntryDto } from "@loomkeep/shared";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionBar from "./ActionBar.svelte";

const entry: LibraryEntryDto = {
  id: "e1",
  mediaItem: {
    id: "m1",
    type: "MOVIE",
    title: "Future movie",
    posterUrl: null,
    canonicalSource: "TMDB",
    sourceId: "1",
  },
  status: "PLANNED",
  rating: null,
  notes: null,
  favorite: false,
  startedAt: null,
  finishedAt: null,
  createdAt: "2026-10-03",
  updatedAt: "2026-10-03",
  lastWatchedAt: null,
  progress: null,
  ownershipStatus: "NONE",
  ownershipSource: null,
  episodeAlertsMuted: false,
  replays: [],
};

function props() {
  return {
    entry,
    isMovie: true,
    upcoming: true,
    saving: false,
    nextEpisode: null,
    continuing: false,
    compact: false,
    title: "Future movie",
    onAdd: vi.fn(),
    onToggleFavorite: vi.fn(),
    onContinue: vi.fn(),
    onToggleWatched: vi.fn(),
    onDrop: vi.fn(),
    onResume: vi.fn(),
    onToggleEpisodeAlerts: vi.fn(),
    onRemove: vi.fn(),
    onToggleMovieAlerts: vi.fn(),
  };
}

describe("upcoming movie action bar", () => {
  it("replaces watched with the reminder action for a tracked upcoming movie", async () => {
    const values = props();
    render(ActionBar, { props: values });
    const button = screen.getByRole("button", {
      name: m.media_movie_reminder_enable(),
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.queryByRole("button", { name: m.media_mark_watched() }),
    ).toBeNull();
    await userEvent.setup().click(button);
    expect(values.onToggleMovieAlerts).toHaveBeenCalledOnce();
    expect(values.onToggleWatched).not.toHaveBeenCalled();
  });
  it("shows no reminder before the movie is added to the library", () => {
    render(ActionBar, { props: { ...props(), entry: null } });
    expect(screen.getByRole("button", { name: m.library_add() })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: m.media_movie_reminder_enable() }),
    ).toBeNull();
  });
  it("shows the active reminder and allows cancellation", () => {
    render(ActionBar, {
      props: {
        ...props(),
        entry: { ...entry, movieReleaseAlertsEnabled: true },
      },
    });
    expect(
      screen
        .getByRole("button", { name: m.media_movie_reminder_cancel() })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText(m.media_movie_reminder_active())).toBeTruthy();
  });
  it("restores the watched action when worldwide release has happened", () => {
    render(ActionBar, { props: { ...props(), upcoming: false } });
    expect(
      screen.getByRole("button", { name: m.media_mark_watched() }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: m.media_movie_reminder_enable() }),
    ).toBeNull();
  });
});
