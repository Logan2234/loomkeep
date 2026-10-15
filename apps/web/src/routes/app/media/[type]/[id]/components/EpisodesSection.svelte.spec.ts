import { ApiError } from "#lib/api/core.js";
import { resolveApiError } from "#lib/api/errors.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import {
  ErrorCode,
  type LibraryEntryDto,
  type MediaDetailEpisodeDto,
  type MediaDetailSeasonDto,
  type MediaType,
} from "@loomkeep/shared";
import { screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreLabel } from "./episode-format";
import EpisodesSection from "./EpisodesSection.svelte";

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

function episode(
  season: number,
  number: number,
  watchCount = 0,
): MediaDetailEpisodeDto {
  return {
    id: `s${season}e${number}`,
    number,
    title: `Episode ${season}.${number}`,
    airDate: inDays(-30),
    runtimeMin: null,
    overview: null,
    stillUrl: null,
    voteAverage: null,
    voteCount: null,
    streamingUrl: null,
    streamingSite: null,
    reviewCount: null,
    reviewAverage: null,
    myRating: null,
    watchCount,
    watches: Array.from({ length: watchCount }, (_, i) => ({
      id: `w${season}${number}${i}`,
      episodeId: `s${season}e${number}`,
      watchedAt: inDays(-1 - i),
    })),
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
    overview: null,
    posterUrl: null,
    airDate: null,
    voteAverage: null,
    reviewCount: null,
    reviewAverage: null,
    myRating: null,
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
    http.get(
      apiUrl("/catalog/tmdb/:id/seasons/:season/episodes/:episode/media"),
      () => HttpResponse.json({ images: [], videos: [] }),
    ),
  );
});

function renderSection(
  seasons: MediaDetailSeasonDto[],
  entry: LibraryEntryDto | null = ENTRY,
  mediaType: MediaType = "SERIES",
) {
  const props = $state({
    seasons,
    entry,
    mediaType,
    sourceId: "1396",
    reload: vi.fn(async () => {}),
    onError: vi.fn(),
  });
  renderWithQuery(EpisodesSection, props);
  return { props, user: userEvent.setup() };
}

const seasonCard = (number: number) =>
  screen.getByRole("button", {
    name: new RegExp(`^${m.common_season()} ${number}\\b`),
  });

async function openSeason(user: ReturnType<typeof userEvent.setup>, n = 1) {
  await user.click(seasonCard(n));
}

const markButtons = () =>
  screen.getAllByRole("button", { name: m.media_mark_watched_short() });

const panel = () => screen.getByRole("dialog");

describe("EpisodesSection", () => {
  it("opens the season being watched, and one season at most", async () => {
    const { user } = renderSection([season(1, [1, 2, 3]), season(2, [1])]);

    expect(seasonCard(2).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Episode 2.2")).toBeTruthy();
    expect(screen.queryByText("Episode 1.1")).toBeNull();

    await openSeason(user, 1);
    expect(screen.getByText("Episode 1.1")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Episode 2.2")).toBeNull());

    // Clicking the open season closes it: no season open is fine too.
    await openSeason(user, 1);
    await waitFor(() => expect(screen.queryByText("Episode 1.1")).toBeNull());
  });

  it("opens no season for a show not started or watched up to date", () => {
    renderSection([season(1), season(2)]);
    expect(seasonCard(1).getAttribute("aria-expanded")).toBe("false");
    expect(seasonCard(2).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText(m.media_episodes_not_started())).toBeTruthy();
  });

  it("shows each episode's synopsis, runtime and scores when known", async () => {
    const s = season(1);
    Object.assign(s.episodes[0], {
      overview: "Inès prend la garde.",
      runtimeMin: 48,
      voteAverage: 8.1,
      reviewAverage: 7,
      reviewCount: 2,
    });
    const { user } = renderSection([s]);
    await openSeason(user);

    expect(screen.getByText("Inès prend la garde.")).toBeTruthy();
    expect(screen.getByText("48:00")).toBeTruthy();
    expect(
      screen.getByText(m.media_score_tmdb({ score: scoreLabel(8.1) })),
    ).toBeTruthy();
    expect(
      screen.getByText(m.media_score_loomkeep({ score: scoreLabel(7) })),
    ).toBeTruthy();
    // Nothing invented for episodes the sources know nothing about.
    expect(screen.getAllByText(/^TMDB /)).toHaveLength(1);
  });

  it("marks the next episode watched right away", async () => {
    const { props, user } = renderSection([season(1, [1])]);

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
    const { user } = renderSection([season(1, [1], 4)]);

    await user.click(markButtons()[2]);
    await user.click(
      screen.getByRole("button", { name: m.media_catch_up_cancel() }),
    );
    await waitFor(() =>
      expect(requests).toEqual(["POST /library/episodes/s1e4/watches"]),
    );

    await user.click(markButtons()[1]);

    await waitFor(() =>
      expect(requests).toEqual([
        "POST /library/episodes/s1e4/watches",
        "POST /library/episodes/s1e3/watches",
      ]),
    );
    expect(screen.queryByText(m.media_catch_up_title())).toBeNull();
  });

  it("shows when an episode airs instead of letting it be marked", async () => {
    const upcoming = season(1, [1], 2);
    upcoming.episodes[1].airDate = inDays(5);
    const { user } = renderSection([upcoming]);
    // Up to date with what has aired, so no season opens on its own.
    await openSeason(user);

    expect(
      screen.getAllByText(m.media_airing_in_days({ days: 5 })).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: m.media_mark_watched_short() }),
    ).toBeNull();
  });

  it("opens an episode's panel with its details and full history", async () => {
    const s = season(1, [1], 2);
    s.episodes[0] = { ...episode(1, 1, 2), overview: "Le pilote." };
    const { user } = renderSection([s]);

    await user.click(
      screen.getByRole("button", {
        name: m.media_episode_open({ code: "S01E01" }),
      }),
    );

    const dialog = within(panel());
    expect(dialog.getByRole("heading", { name: /Episode 1\.1/ })).toBeTruthy();
    expect(dialog.getByText("Le pilote.")).toBeTruthy();
    expect(dialog.getByText(m.media_episode_times({ count: 2 }))).toBeTruthy();
    // The viewings as a timeline: the first, then the rewatch.
    expect(dialog.getByText(m.media_episode_watched())).toBeTruthy();
    expect(dialog.getByText(m.media_episode_rewatched())).toBeTruthy();
  });

  it("walks previous/next across seasons, with nothing past either end", async () => {
    const { user } = renderSection([season(1, [1, 2, 3], 2), season(2, [], 2)]);
    await openSeason(user, 1);
    await user.click(screen.getByRole("button", { name: "Episode 1.1" }));

    expect(
      within(panel()).queryByRole("button", {
        name: m.media_episode_previous(),
      }),
    ).toBeNull();

    await user.click(
      within(panel()).getByRole("button", { name: m.media_episode_next() }),
    );
    await user.click(
      within(panel()).getByRole("button", { name: m.media_episode_next() }),
    );

    // Past season 1's last episode comes season 2's first, the list too.
    expect(
      within(panel()).getByRole("heading", { name: /Episode 2\.1/ }),
    ).toBeTruthy();
    expect(seasonCard(2).getAttribute("aria-expanded")).toBe("true");

    await user.click(
      within(panel()).getByRole("button", { name: m.media_episode_next() }),
    );
    expect(
      within(panel()).queryByRole("button", { name: m.media_episode_next() }),
    ).toBeNull();
  });

  it("rewatches or undoes an episode from its panel", async () => {
    const { user } = renderSection([season(1, [1])]);
    await user.click(screen.getByRole("button", { name: "Episode 1.1" }));

    await user.click(
      within(panel()).getByRole("button", { name: m.media_rewatch() }),
    );
    await user.click(
      within(panel()).getByRole("button", { name: m.media_undo_watch() }),
    );

    await waitFor(() =>
      expect(requests).toEqual([
        "POST /library/episodes/s1e1/watches",
        "DELETE /library/episodes/s1e1/watches",
      ]),
    );
  });

  it("moves on to the next episode once one is marked from its panel", async () => {
    const { user } = renderSection([season(1, [1])]);
    await user.click(screen.getByRole("button", { name: "Episode 1.2" }));

    await user.click(
      within(panel()).getByRole("button", {
        name: m.media_mark_watched_short(),
      }),
    );

    await waitFor(() =>
      expect(requests).toEqual(["POST /library/episodes/s1e2/watches"]),
    );
    expect(
      within(panel()).getByRole("heading", { name: /Episode 1\.3/ }),
    ).toBeTruthy();

    await user.click(
      within(panel()).getByRole("button", { name: m.media_episode_previous() }),
    );
    expect(
      within(panel()).getByRole("heading", { name: /Episode 1\.2/ }),
    ).toBeTruthy();
  });

  it("marks the aired episodes of a season from its summary", async () => {
    const { user } = renderSection([season(1, [1])]);

    await user.click(
      screen.getByRole("button", { name: m.media_mark_aired_watched() }),
    );

    await waitFor(() =>
      expect(requests).toEqual(["POST /library/seasons/season1/watches"]),
    );
  });

  it("asks before clearing a season's watches", async () => {
    const { user } = renderSection([season(1, [1, 2, 3])]);
    await openSeason(user);

    await user.click(
      screen.getByRole("button", { name: m.media_undo_season() }),
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
    const { props, user } = renderSection([season(1, [1])]);

    await user.click(markButtons()[0]);

    await waitFor(() =>
      expect(props.onError).toHaveBeenLastCalledWith(resolveApiError(failure)),
    );
    expect(props.reload).not.toHaveBeenCalled();
  });

  it("links an anime episode to where it streams", async () => {
    const s = season(1, [1], 2);
    Object.assign(s.episodes[1], {
      streamingUrl: "https://cr.example/2",
      streamingSite: "Crunchyroll",
    });
    const { user } = renderSection([s], ENTRY, "ANIME");
    await user.click(screen.getByRole("button", { name: "Episode 1.2" }));

    const link = within(panel()).getByRole("link", {
      name: m.media_watch_on({ site: "Crunchyroll" }),
    });
    expect(link.getAttribute("href")).toBe("https://cr.example/2");
    expect(
      within(panel()).getByText(m.media_episode_no_synopsis_anime()),
    ).toBeTruthy();
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
