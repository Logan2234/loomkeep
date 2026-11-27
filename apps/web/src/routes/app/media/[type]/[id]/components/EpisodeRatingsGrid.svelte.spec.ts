import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { MediaDetailSeasonDto } from "@loomkeep/shared/contracts";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EpisodeRatingsGrid from "./EpisodeRatingsGrid.svelte";
import { ratingBand } from "./episode-ratings";

const episode = (
  number: number,
  voteAverage: number | null,
  myRating: number | null = null,
) => ({ number, title: `Episode ${number}`, voteAverage, myRating }) as never;

const SEASONS = [
  { number: 0, episodes: [episode(1, 9)] },
  { number: 2, episodes: [episode(1, 6.4), episode(2, null)] },
  {
    number: 1,
    episodes: [episode(1, 8.7, 9), episode(2, 7.2), episode(3, 5.1)],
  },
] as unknown as MediaDetailSeasonDto[];

describe("ratingBand", () => {
  it("bands a rating, and has none for a missing one", () => {
    expect(ratingBand(null)).toBeNull();
    expect(ratingBand(5.9)?.min).toBe(0);
    expect(ratingBand(7)?.min).toBe(7);
    expect(ratingBand(8.5)?.min).toBe(8.5);
  });
});

describe("EpisodeRatingsGrid", () => {
  it("lays regular seasons out in order, specials left out, and opens a cell's episode", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(EpisodeRatingsGrid, { seasons: SEASONS, onOpen });

    const rows = screen
      .getAllByRole("rowheader")
      .map((th) => th.textContent?.trim());
    expect(rows).toEqual([
      m.media_season_short({ number: 1 }),
      m.media_season_short({ number: 2 }),
    ]);

    const unrated = screen.getByRole("button", {
      name: m.media_episode_ratings_cell({
        season: 2,
        episode: 2,
        rating: m.media_episode_ratings_none(),
      }),
    });
    expect(unrated).toBeTruthy();

    const mine = screen.getByRole("button", {
      name: new RegExp(m.media_episode_ratings_mine({ rating: "" })),
    });
    await user.click(mine);
    expect(onOpen).toHaveBeenCalledWith({ season: 1, episode: 1 });
  });
});
