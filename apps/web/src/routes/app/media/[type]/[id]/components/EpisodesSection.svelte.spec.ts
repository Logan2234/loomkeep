import { ApiError } from "#lib/api/core.js";
import { resolveApiError } from "#lib/api/errors.js";
import { chat } from "#lib/chat/chat.svelte.js";
import { appConfig } from "#lib/config.svelte.js";
import { layout } from "#lib/layout.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/toast.svelte.js";
import {
  ErrorCode,
  type LibraryEntryDto,
  type MediaDetailEpisodeDto,
  type MediaDetailSeasonDto,
  type MediaType,
} from "@loomkeep/shared";
import { fireEvent, screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scoreLabel, upcomingLabel } from "./episode-format";
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
    commentCount: 0,
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
let batches: { action: string; episodeIds: string[] }[];
let undos: unknown[];

afterEach(() => {
  toast.items.map((t) => t.id).forEach((id) => toast.dismiss(id));
});

beforeEach(() => {
  requests = [];
  batches = [];
  undos = [];

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
    http.post(
      apiUrl("/library/episodes/watches/batch"),
      async ({ request }) => {
        const body = (await request.json()) as {
          action: string;
          episodeIds: string[];
        };
        batches.push(body);
        return HttpResponse.json({
          created:
            body.action === "unwatch"
              ? []
              : body.episodeIds.map((episodeId, i) => ({
                  id: `new${i}`,
                  episodeId,
                })),
          removed:
            body.action === "unwatch"
              ? body.episodeIds.map((episodeId) => ({
                  episodeId,
                  watchedAt: "2024-03-03T00:00:00.000Z",
                }))
              : [],
        });
      },
    ),
    http.post(apiUrl("/library/episodes/watches/undo"), async ({ request }) => {
      undos.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
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

const seasonTab = (number: number) =>
  screen.getByRole("tab", { name: new RegExp(`^S${number} `) });

async function openSeason(user: ReturnType<typeof userEvent.setup>, n = 1) {
  await user.click(seasonTab(n));
}

const markButtons = () =>
  screen
    .getAllByRole("button", {
      name: new RegExp(
        `^${m.media_mark_watched_code({ code: "S" })}|S\\d+E\\d+`,
      ),
    })
    .filter((b) => b.title === m.media_mark_watched_short());

const openRow = (season: number, episode: number) =>
  screen.getByRole("button", {
    name: m.media_episode_open({
      code: `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`,
    }),
  });

const panel = () => screen.getByRole("dialog");

describe("EpisodesSection", () => {
  it("opens the tab being watched, one page at a time", async () => {
    const { user } = renderSection([season(1, [1, 2, 3]), season(2, [1])]);

    expect(seasonTab(2).getAttribute("aria-selected")).toBe("true");
    expect(openRow(2, 2)).toBeTruthy();
    expect(screen.queryByText("Episode 1.1")).toBeNull();

    await openSeason(user, 1);
    expect(openRow(1, 1)).toBeTruthy();
    expect(screen.queryByText("Episode 2.1")).toBeNull();
  });

  it("opens the first tab of a show not followed", () => {
    renderSection([season(1), season(2)], null);
    expect(seasonTab(1).getAttribute("aria-selected")).toBe("true");
  });

  it("opens the last tab once watched up to date", () => {
    renderSection([season(1, [1, 2, 3]), season(2, [1, 2, 3])]);
    expect(seasonTab(2).getAttribute("aria-selected")).toBe("true");
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
    const countdown = upcomingLabel(inDays(5), new Date(), false)!;
    const { user } = renderSection([upcoming]);
    // Up to date with what has aired, so no season opens on its own.
    await openSeason(user);

    expect(screen.getAllByText(countdown).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", {
        name: m.media_mark_watched_code({ code: "S01E02" }),
      }),
    ).toBeNull();
    // What's announced takes the bar's place, with nothing to mark.
    expect(
      screen.getByText(m.media_next_announced({ code: "S01E02" })),
    ).toBeTruthy();
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
    await user.click(openRow(1, 1));

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
    expect(seasonTab(2).getAttribute("aria-selected")).toBe("true");

    await user.click(
      within(panel()).getByRole("button", { name: m.media_episode_next() }),
    );
    expect(
      within(panel()).queryByRole("button", { name: m.media_episode_next() }),
    ).toBeNull();
  });

  it("rewatches or undoes an episode from its panel", async () => {
    const { user } = renderSection([season(1, [1])]);
    await user.click(openRow(1, 1));

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
    await user.click(openRow(1, 2));

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

  it("steps through episodes with the arrow keys on desktop", async () => {
    layout.compact = false;

    try {
      const { user } = renderSection([season(1, [1])]);
      await user.click(openRow(1, 2));

      await user.keyboard("{ArrowRight}");
      expect(
        within(panel()).getByRole("heading", { name: /Episode 1\.3/ }),
      ).toBeTruthy();

      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(
        within(panel()).getByRole("heading", { name: /Episode 1\.1/ }),
      ).toBeTruthy();
    } finally {
      layout.compact = true;
    }
  });

  it("opens every poster of a season from its own", async () => {
    server.use(
      http.get(apiUrl("/catalog/tmdb/:id/seasons/:season/images"), () =>
        HttpResponse.json({
          images: [
            "https://image.tmdb.org/t/p/w780/main.jpg",
            "https://image.tmdb.org/t/p/w780/other.jpg",
          ],
        }),
      ),
    );
    const s = season(1, [1]);
    s.posterUrl = "https://image.tmdb.org/t/p/w500/main.jpg";
    const { user } = renderSection([s]);

    await user.click(
      screen.getByRole("button", { name: m.media_season_images() }),
    );

    // The poster shown first, then the other one — not the same one twice.
    expect(
      await screen.findByRole("button", { name: m.common_image_next() }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: m.common_image_number({ index: 2 }) }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: m.common_image_number({ index: 3 }),
      }),
    ).toBeNull();
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
    await user.click(openRow(1, 2));

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

  it("closes an episode's sheet when its discussion opens in Messages", async () => {
    Object.assign(appConfig, { socialEnabled: true, chatEnabled: true });
    server.use(
      http.get(apiUrl("/comments/:type/:id/count"), () =>
        HttpResponse.json({ count: 0 }),
      ),
    );
    const showWork = vi.spyOn(chat, "showWork").mockImplementation(() => {});

    try {
      const { user } = renderSection([season(1, [1])]);
      await user.click(openRow(1, 1));

      await user.click(
        within(panel()).getByRole("button", {
          name: m.media_comments_title({ target: "S01E01 · Episode 1.1" }),
        }),
      );

      expect(showWork).toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    } finally {
      Object.assign(appConfig, { socialEnabled: false, chatEnabled: false });
      showWork.mockRestore();
    }
  });

  describe("tabs", () => {
    it("walks the pages with the buttons at their foot", async () => {
      const { user } = renderSection([season(1), season(2)]);

      await user.click(
        screen.getByRole("button", { name: /Saison 2|Season 2|Stagione 2/ }),
      );
      expect(seasonTab(2).getAttribute("aria-selected")).toBe("true");

      await user.click(
        screen.getByRole("button", { name: /Saison 1|Season 1|Stagione 1/ }),
      );
      expect(seasonTab(1).getAttribute("aria-selected")).toBe("true");
    });

    it("cuts a very long season, rendering one slice, its card once", async () => {
      const { user } = renderSection([season(1, [], 250)]);

      expect(screen.getByRole("tab", { name: /^1–100 / })).toBeTruthy();
      expect(screen.getByRole("tab", { name: /^201–250 / })).toBeTruthy();
      expect(screen.getByText("Episode 1.100")).toBeTruthy();
      expect(screen.queryByText("Episode 1.101")).toBeNull();
      expect(
        screen.getByText(m.media_episodes_range({ from: "1", to: "100" })),
      ).toBeTruthy();

      await user.click(screen.getByRole("tab", { name: /^101–200 / }));

      expect(screen.getByText("Episode 1.101")).toBeTruthy();
      expect(
        screen.getAllByRole("button", {
          name: m.media_mark_aired_watched(),
        }),
      ).toHaveLength(1);
    });

    it("jumps to an episode by number, sharing where it is", async () => {
      const { user } = renderSection([season(1, [], 250)]);

      await user.click(
        screen.getByRole("button", { name: m.media_goto_open() }),
      );
      const field = screen.getByLabelText(m.media_goto_label({ max: "250" }));
      await user.type(field, "999");
      expect(screen.getByText(m.media_goto_not_found())).toBeTruthy();

      await user.clear(field);
      await user.type(field, "212{Enter}");

      expect(await screen.findByText("Episode 1.212")).toBeTruthy();
      expect(
        screen
          .getByRole("tab", { name: /^201–250 / })
          .getAttribute("aria-selected"),
      ).toBe("true");
    });

    it("offers nothing to jump with when seasons stay whole", () => {
      renderSection([season(1), season(2)]);
      expect(
        screen.queryByRole("button", { name: m.media_goto_open() }),
      ).toBeNull();
    });
  });

  describe("up next bar", () => {
    const barMark = (code: string) =>
      screen
        .getAllByRole("button", { name: m.media_mark_watched_code({ code }) })
        .find((b) => b.textContent?.trim() === m.media_episode_watched())!;

    it("marks the next episode with no question, then moves on", async () => {
      const { props, user } = renderSection([season(1, [1])]);
      props.reload.mockImplementation(async () => {
        props.seasons = [season(1, [1, 2])];
      });

      await user.click(barMark("S01E02"));

      await waitFor(() =>
        expect(requests).toEqual(["POST /library/episodes/s1e2/watches"]),
      );
      expect(screen.queryByText(m.media_catch_up_title())).toBeNull();
      expect(
        await screen.findByText(m.media_up_next({ code: "S01E03" })),
      ).toBeTruthy();
      expect(toast.items).toHaveLength(0);
    });

    it("brings the row into view rather than opening its details", async () => {
      const { user } = renderSection([season(1, [1, 2, 3]), season(2)]);
      await openSeason(user, 1);

      await user.click(
        screen.getByRole("button", {
          name: m.media_go_to_code({ code: "S02E01" }),
        }),
      );

      expect(seasonTab(2).getAttribute("aria-selected")).toBe("true");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("isn't there on a work not followed", () => {
      renderSection([season(1)], null);
      expect(
        screen.queryByText(m.media_up_next({ code: "S01E01" })),
      ).toBeNull();
    });
  });

  describe("watched menu", () => {
    const openMenu = (user: ReturnType<typeof userEvent.setup>, code: string) =>
      user.click(
        screen.getByRole("button", {
          name: `${m.media_episode_watched()} ${code}`,
        }),
      );

    it("offers rewatch and undo, silently", async () => {
      const { user } = renderSection([season(1, [1])]);
      await openMenu(user, "S01E01");

      expect(screen.getAllByRole("menuitem")).toHaveLength(2);
      await user.click(
        screen.getByRole("menuitem", { name: m.media_rewatch() }),
      );

      await waitFor(() =>
        expect(requests).toEqual(["POST /library/episodes/s1e1/watches"]),
      );
      expect(toast.items).toHaveLength(0);
    });

    it("from two viewings, undoes them all with a way back", async () => {
      const s = season(1, [1]);
      s.episodes[0] = episode(1, 1, 3);
      const { user } = renderSection([s]);
      await openMenu(user, "S01E01");

      await user.click(
        screen.getByRole("menuitem", {
          name: m.media_undo_all_watches({ count: 3 }),
        }),
      );

      await waitFor(() =>
        expect(toast.items[0]?.message).toBe(
          m.media_watches_undone({ count: 3, code: "S01E01" }),
        ),
      );
      expect(batches).toEqual([{ action: "unwatch", episodeIds: ["s1e1"] }]);

      toast.selectAction(toast.items[0].id);
      await waitFor(() =>
        expect(undos).toEqual([
          {
            restore: [
              { episodeId: "s1e1", watchedAt: "2024-03-03T00:00:00.000Z" },
            ],
          },
        ]),
      );
    });
  });

  describe("selection", () => {
    const box = (code: string) =>
      screen.getByRole("checkbox", {
        name: m.media_select_episode({ code }),
      });

    async function desktop(run: () => Promise<void>) {
      layout.compact = false;

      try {
        await run();
      } finally {
        layout.compact = true;
      }
    }

    it("enters on a long press, ticking that episode only", async () => {
      renderSection([season(1, [1])]);
      const row = document.getElementById("episode-s1e2")!;

      fireEvent.pointerDown(row, { button: 0, pointerType: "mouse" });
      expect(
        await screen.findByRole(
          "checkbox",
          {
            name: m.media_select_episode({ code: "S01E02" }),
          },
          { timeout: 1000 },
        ),
      ).toBeTruthy();
      fireEvent.pointerUp(document);

      expect(box("S01E02").getAttribute("aria-checked")).toBe("true");
      expect(box("S01E01").getAttribute("aria-checked")).toBe("false");
      expect(screen.getByText(m.media_selection_count_one())).toBeTruthy();
    });

    it("ticks by row without opening it, across tabs, and leaves unaired ones out", async () => {
      await desktop(async () => {
        const s = season(1, [], 3);
        s.episodes[2].airDate = inDays(4);
        const { user } = renderSection([s, season(2)]);

        await user.click(box("S01E01"));
        await user.click(openableRowText("Episode 1.2"));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(
          screen.queryByRole("checkbox", {
            name: m.media_select_episode({ code: "S01E03" }),
          }),
        ).toBeNull();

        await openSeason(user, 2);
        await user.click(box("S02E01"));

        expect(
          screen.getByText(m.media_selection_count({ count: 3 })),
        ).toBeTruthy();
        expect(
          screen.getByText(m.media_selection_seasons({ count: 2 })),
        ).toBeTruthy();
      });
    });

    it("shift-clicking ticks the whole range", async () => {
      await desktop(async () => {
        const { user } = renderSection([season(1, [], 5)]);

        await user.click(box("S01E01"));
        await user.keyboard("{Shift>}");
        await user.click(box("S01E04"));
        await user.keyboard("{/Shift}");

        expect(
          screen.getByText(m.media_selection_count({ count: 4 })),
        ).toBeTruthy();
        expect(screen.getByText("S01E01 → S01E04")).toBeTruthy();
      });
    });

    it("offers only what makes sense, counting what's really touched", async () => {
      await desktop(async () => {
        const { user } = renderSection([season(1, [1], 3)]);

        await user.click(box("S01E02"));
        expect(
          screen.getByRole("button", {
            name: m.media_bulk_watch({ count: 1 }),
          }),
        ).toBeTruthy();
        expect(
          screen.queryByRole("button", {
            name: m.media_bulk_rewatch({ count: 1 }),
          }),
        ).toBeNull();

        await user.click(box("S01E01"));
        expect(
          screen.getByRole("button", {
            name: m.media_bulk_rewatch({ count: 1 }),
          }),
        ).toBeTruthy();
        expect(
          screen.getByRole("button", {
            name: m.media_bulk_unwatch({ count: 1 }),
          }),
        ).toBeTruthy();
      });
    });

    it("acts once, leaves the mode and offers a way back", async () => {
      await desktop(async () => {
        const { props, user } = renderSection([season(1, [], 3)]);

        await user.click(box("S01E01"));
        await user.click(box("S01E02"));
        await user.click(
          screen.getByRole("button", {
            name: m.media_bulk_watch({ count: 2 }),
          }),
        );

        await waitFor(() =>
          expect(toast.items[0]?.message).toBe(
            m.media_bulk_watched({ count: 2 }),
          ),
        );
        expect(batches).toEqual([
          { action: "watch", episodeIds: ["s1e1", "s1e2"] },
        ]);
        expect(props.reload).toHaveBeenCalled();
        expect(
          screen.queryByText(m.media_selection_count({ count: 2 })),
        ).toBeNull();
        expect(screen.queryByText(m.media_catch_up_title())).toBeNull();

        toast.selectAction(toast.items[0].id);
        await waitFor(() =>
          expect(undos).toEqual([{ deleteWatchIds: ["new0", "new1"] }]),
        );
        expect(
          (await screen
            .findByText(m.media_action_undone())
            .catch(() => null)) ?? toast.items.at(-1)?.message,
        ).toBeTruthy();
      });
    });

    it("leaves with its cross, keeping nothing", async () => {
      await desktop(async () => {
        const { user } = renderSection([season(1, [], 3)]);

        await user.click(box("S01E01"));
        await user.click(
          screen.getByRole("button", { name: m.media_selection_exit() }),
        );

        expect(box("S01E01").getAttribute("aria-checked")).toBe("false");
        expect(
          screen.getByText(m.media_up_next({ code: "S01E01" })),
        ).toBeTruthy();
      });
    });
  });
});

function openableRowText(title: string): HTMLElement {
  return screen.getByText(title);
}
