import { vi } from "vitest";
import type { MediaItemService } from "../../../catalog/media-item.service";
import type { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { ReviewService } from "../../../reviews/review.service";
import type { MediaMatchResolver } from "../media/media-match-resolver";
import { ImdbImportSource } from "./imdb.source";

const RATINGS_HEADER =
  "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors";

/** Two episodes of one series, plus one of another. */
const EPISODES = [
  RATINGS_HEADER,
  "tt0959621,10,2026-01-01,Ozymandias,,https://x,TV Episode,9.9,48,2013,,,,",
  "tt2301451,9,2026-01-02,Fly,,https://x,TV Episode,7.9,47,2010,,,,",
  "tt4283088,8,2026-01-03,Battle of the Bastards,,https://x,TV Episode,9.9,60,2016,,,,",
].join("\n");

const LOCATED: Record<
  string,
  { seriesTmdbId: string; season: number; episode: number } | null
> = {
  tt0959621: { seriesTmdbId: "1396", season: 5, episode: 14 },
  tt2301451: { seriesTmdbId: "1396", season: 3, episode: 10 },
  tt4283088: { seriesTmdbId: "1399", season: 6, episode: 9 },
};

function makeSource(
  findEpisodeByImdbId = vi.fn((id: string) =>
    Promise.resolve(LOCATED[id] ?? null),
  ),
) {
  const source = new ImdbImportSource(
    {} as unknown as PrismaService,
    {} as unknown as MediaItemService,
    {} as unknown as MediaMatchResolver,
    {} as unknown as ReviewService,
    { findEpisodeByImdbId } as unknown as TmdbProvider,
  );

  // `load` is the hook buildPlan calls before resolving anything; driven
  // directly here so the test stays on the episode logic.
  const load = (parsed: ReturnType<typeof source.parseInput>) =>
    (
      source as unknown as {
        load: (p: ReturnType<typeof source.parseInput>) => Promise<void>;
      }
    ).load(parsed);

  return { source, load, findEpisodeByImdbId };
}

describe("ImdbImportSource — rated episodes", () => {
  it("groups episodes of one series into a single show", async () => {
    const { source, load } = makeSource();
    const parsed = source.parseInput(EPISODES);

    await load(parsed);

    expect(parsed.shows).toHaveLength(2);
    const breakingBad = parsed.shows.find((s) => s.externalIds.tmdb === "1396");
    expect(breakingBad?.episodes).toHaveLength(2);
    expect(
      breakingBad?.episodes.map((e) => [e.season, e.episode]).sort(),
    ).toEqual([
      [3, 10],
      [5, 14],
    ]);
  });

  it("keeps each episode's own rating on the episode", async () => {
    // The rating belongs to the episode, not the series — ReviewTargetType
    // has an EPISODE member for exactly this.
    const { source, load } = makeSource();
    const parsed = source.parseInput(EPISODES);

    await load(parsed);

    const episode = parsed.shows
      .flatMap((s) => s.episodes)
      .find((e) => e.season === 5 && e.episode === 14);
    expect(episode?.rating).toBe(10);
  });

  it("attaches episodes to a series the export already listed", async () => {
    const { source, load } = makeSource();
    const parsed = source.parseInput(
      [
        RATINGS_HEADER,
        "tt0903747,10,2026-01-02,Breaking Bad,,https://x,TV Series,9.5,49,2008,,,,",
        "tt0959621,10,2026-01-01,Ozymandias,,https://x,TV Episode,9.9,48,2013,,,,",
      ].join("\n"),
    );
    // The series row resolves by IMDb id, so it has no TMDB id yet; the
    // episode lookup is what introduces one.
    parsed.shows[0].externalIds.tmdb = "1396";

    await load(parsed);

    expect(parsed.shows).toHaveLength(1);
    expect(parsed.shows[0].title).toBe("Breaking Bad");
    expect(parsed.shows[0].episodes).toHaveLength(1);
  });

  it("drops an episode TMDB cannot place instead of failing the import", async () => {
    const { source, load } = makeSource(vi.fn(() => Promise.resolve(null)));
    const parsed = source.parseInput(EPISODES);

    await expect(load(parsed)).resolves.toBeUndefined();
    expect(parsed.shows).toEqual([]);
  });

  it("survives a lookup that throws", async () => {
    const { source, load } = makeSource(
      vi.fn(() => Promise.reject(new Error("TMDB down"))),
    );
    const parsed = source.parseInput(EPISODES);

    await expect(load(parsed)).resolves.toBeUndefined();
    expect(parsed.shows).toEqual([]);
  });

  it("does not call TMDB when the export rated no episode", async () => {
    const { source, load, findEpisodeByImdbId } = makeSource();
    const parsed = source.parseInput(
      `${RATINGS_HEADER}\ntt1,7,2026-01-01,Un film,,https://x,Movie,7,100,2001,,,,`,
    );

    await load(parsed);

    expect(findEpisodeByImdbId).not.toHaveBeenCalled();
  });
});
