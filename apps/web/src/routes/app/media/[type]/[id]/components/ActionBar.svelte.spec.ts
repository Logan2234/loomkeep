import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import type { LibraryEntryDto, UserDto } from "@loomkeep/shared";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("release alerts in the action bar", () => {
  const series = { ...props(), isMovie: false, upcoming: false };

  afterEach(() => {
    auth.user = null;
  });

  it("offers a running show's episode alerts, not a finished one's", async () => {
    const user = userEvent.setup();
    const { unmount } = render(ActionBar, { props: series });
    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    expect(
      screen.getByRole("menuitem", {
        name: new RegExp(m.media_mute_episode_alerts()),
      }),
    ).toBeTruthy();
    unmount();

    render(ActionBar, { props: { ...series, airingFinished: true } });
    await user.click(
      screen.getByRole("button", { name: m.common_more_actions() }),
    );
    expect(
      screen.queryByRole("menuitem", {
        name: new RegExp(m.media_mute_episode_alerts()),
      }),
    ).toBeNull();
  });

  it("greys the reminder out while no release summary is on", () => {
    auth.user = {
      id: "u1",
      notifyEmail: "DISABLED",
      notifyPush: "DISABLED",
    } as UserDto;
    render(ActionBar, { props: props() });

    const bell = screen.getByRole("button", {
      name: m.media_movie_reminder_enable(),
    }) as HTMLButtonElement;
    expect(bell.disabled).toBe(true);
  });
});
