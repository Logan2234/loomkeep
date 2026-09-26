import { ApiError } from "$lib/api/core";
import { resolveApiError } from "$lib/api/errors";
import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import {
  ErrorCode,
  type LibraryEntryDto,
  type MediaDetailSeasonDto,
} from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EpisodesSection from "./EpisodesSection.svelte";

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

function episode(season: number, number: number, watchCount = 0) {
  return {
    id: `s${season}e${number}`,
    number,
    title: `Episode ${season}.${number}`,
    airDate: inDays(-30),
    watchCount,
    watches: watchCount
      ? [{ id: `w${season}${number}`, watchedAt: inDays(-1), rating: null }]
      : [],
  };
}

function season(
  number: number,
  watched: number[] = [],
  count = 3,
): MediaDetailSeasonDto {
  return {
    id: `season${number}`,
    number,
    title: null,
    episodes: Array.from({ length: count }, (_, i) =>
      episode(number, i + 1, watched.includes(i + 1) ? 1 : 0),
    ),
  };
}

const ENTRY = { id: "entry" } as LibraryEntryDto;

let requests: string[];

beforeEach(() => {
  requests = [];

  const record = ({ request }: { request: Request }) => {
    requests.push(
      `${request.method} ${new URL(request.url).pathname.replace(/^\/api/, "")}`,
    );
    return new HttpResponse(null, { status: 201 });
  };

  server.use(
    http.post(apiUrl("/library/episodes/:id/watches"), record),
    http.delete(apiUrl("/library/episodes/:id/watches"), record),
    http.post(apiUrl("/library/episodes/:id/watch-through"), record),
    http.post(apiUrl("/library/seasons/:id/watches"), record),
    http.delete(apiUrl("/library/seasons/:id/watches"), record),
  );
});

function renderSection(
  seasons: MediaDetailSeasonDto[],
  entry: LibraryEntryDto | null = ENTRY,
) {
  const props = $state({
    seasons,
    entry,
    reload: vi.fn(async () => {}),
    onError: vi.fn(),
  });
  renderWithQuery(EpisodesSection, props);
  return { props, user: userEvent.setup() };
}

const seasonHeader = (number: number) =>
  screen.getByRole("button", {
    name: new RegExp(`^${m.common_season()} ${number}\\b`),
  });

async function openSeason(user: ReturnType<typeof userEvent.setup>, n = 1) {
  await user.click(seasonHeader(n));
}

const markButtons = () =>
  screen.getAllByRole("button", { name: m.media_mark_watched_short() });

describe("EpisodesSection", () => {
  it("keeps seasons collapsed and shows each season's progress", async () => {
    const { user } = renderSection([season(1, [1]), season(2)]);

    expect(screen.queryByText("Episode 1.1")).toBeNull();
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.getByText("0/3")).toBeTruthy();

    await openSeason(user);

    expect(screen.getByText("Episode 1.1")).toBeTruthy();
    expect(screen.queryByText("Episode 2.1")).toBeNull();
    expect(seasonHeader(1).getAttribute("aria-expanded")).toBe("true");
  });

  it("marks the next episode watched right away", async () => {
    const { props, user } = renderSection([season(1, [1])]);
    await openSeason(user);

    await user.click(markButtons()[0]);

    await waitFor(() =>
      expect(requests).toEqual(["POST /library/episodes/s1e2/watches"]),
    );
    expect(props.reload).toHaveBeenCalled();
  });

  it("offers to catch up on the earlier unwatched episodes", async () => {
    const { user } = renderSection([season(1, [1]), season(2)]);
    await openSeason(user, 2);

    // S02E02 skips S01E02, S01E03 and S02E01.
    await user.click(markButtons()[1]);
    expect(
      screen.getByText(m.media_catch_up_message({ count: 3 })),
    ).toBeTruthy();
    expect(requests).toEqual([]);

    await user.click(
      screen.getByRole("button", { name: m.media_catch_up_confirm() }),
    );

    await waitFor(() =>
      expect(requests).toEqual(["POST /library/episodes/s2e2/watch-through"]),
    );
  });

  it("stops asking once catching up was declined", async () => {
    const { user } = renderSection([season(1)]);
    await openSeason(user);

    await user.click(markButtons()[2]);
    await user.click(
      screen.getByRole("button", { name: m.media_catch_up_cancel() }),
    );
    await waitFor(() =>
      expect(requests).toEqual(["POST /library/episodes/s1e3/watches"]),
    );

    await user.click(markButtons()[1]);

    await waitFor(() =>
      expect(requests).toEqual([
        "POST /library/episodes/s1e3/watches",
        "POST /library/episodes/s1e2/watches",
      ]),
    );
    expect(screen.queryByText(m.media_catch_up_title())).toBeNull();
  });

  it("leaves specials out of the catch-up count", async () => {
    const { user } = renderSection([season(0), season(1)]);
    await openSeason(user, 1);

    await user.click(markButtons()[0]);

    await waitFor(() =>
      expect(requests).toEqual(["POST /library/episodes/s1e1/watches"]),
    );
  });

  it("shows when an episode airs instead of letting it be marked", async () => {
    const upcoming = season(1, [], 1);
    upcoming.episodes[0].airDate = inDays(5);
    const { user } = renderSection([upcoming]);
    await openSeason(user);

    expect(screen.getByText(m.media_airing_in_days({ days: 5 }))).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: m.media_mark_watched_short() }),
    ).toBeNull();
  });

  it("rewatches or undoes an episode already watched", async () => {
    const { user } = renderSection([season(1, [1])]);
    await openSeason(user);

    await user.click(screen.getByRole("button", { name: m.media_rewatch() }));
    await user.click(
      screen.getByRole("button", { name: m.media_undo_watch() }),
    );

    await waitFor(() =>
      expect(requests).toEqual([
        "POST /library/episodes/s1e1/watches",
        "DELETE /library/episodes/s1e1/watches",
      ]),
    );
  });

  it("marks a whole season from its menu", async () => {
    const { user } = renderSection([season(1)]);

    await user.click(
      screen.getByRole("button", { name: m.media_season_more_actions() }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.media_mark_season_watched() }),
    );

    await waitFor(() =>
      expect(requests).toEqual(["POST /library/seasons/season1/watches"]),
    );
  });

  it("asks before clearing a season's watches", async () => {
    const { user } = renderSection([season(1, [1, 2, 3])]);

    await user.click(
      screen.getByRole("button", { name: m.media_season_more_actions() }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: m.media_undo_season() }),
    );
    expect(screen.getByText(m.media_undo_season_message())).toBeTruthy();
    expect(requests).toEqual([]);

    await user.click(screen.getByRole("button", { name: m.media_undo_all() }));

    await waitFor(() =>
      expect(requests).toEqual(["DELETE /library/seasons/season1/watches"]),
    );
  });

  it("congratulates once the last episode of a season is watched", async () => {
    const { props, user } = renderSection([season(1, [1, 2])]);
    props.reload.mockImplementation(async () => {
      props.seasons = [season(1, [1, 2, 3])];
    });
    await openSeason(user);
    expect(screen.queryByText(m.media_season_finished())).toBeNull();

    await user.click(markButtons()[0]);

    expect(await screen.findByText(m.media_season_finished())).toBeTruthy();
  });

  it("reports a failed update through onError", async () => {
    const failure = new ApiError(0, "offline", ErrorCode.NetworkOffline);
    server.use(
      http.post(apiUrl("/library/episodes/:id/watches"), () =>
        HttpResponse.error(),
      ),
    );
    const { props, user } = renderSection([season(1)]);
    await openSeason(user);

    await user.click(markButtons()[0]);

    await waitFor(() =>
      expect(props.onError).toHaveBeenLastCalledWith(resolveApiError(failure)),
    );
    expect(props.reload).not.toHaveBeenCalled();
  });

  it("shows episodes without tracking actions outside the library", async () => {
    const { user } = renderSection([season(1)], null);
    await openSeason(user);

    expect(screen.getByText("Episode 1.1")).toBeTruthy();
    expect(screen.queryByText("0/3")).toBeNull();
    expect(
      screen.queryByRole("button", { name: m.media_mark_watched_short() }),
    ).toBeNull();
  });
});
