import type { MediaSummaryDto } from "@loomkeep/shared";
import { vi } from "vitest";
import type { MediaItemService } from "../../../catalog/media-item.service";
import type { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import type { ListService } from "../../../lists/list.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { ReviewService } from "../../../reviews/review.service";
import type { ProgressReporter } from "../../import-source";
import type { MediaMatchResolver } from "../media/media-match-resolver";
import { ImdbImportSource } from "./imdb.source";

const RATINGS_HEADER =
  "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors";
const LIST_HEADER =
  "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated";

const ratings = (...rows: string[]) => [RATINGS_HEADER, ...rows].join("\n");

const BREAKING_BAD =
  "tt0903747,10,2026-01-02,Breaking Bad,,https://x,TV Series,9.5,49,2008,,,,";
const OZYMANDIAS =
  "tt0959621,10,2026-01-01,Ozymandias,,https://x,TV Episode,9.9,48,2013,,,,";
const FLY = "tt2301451,9,2026-01-02,Fly,,https://x,TV Episode,7.9,47,2010,,,,";
const BASTARDS =
  "tt4283088,8,2026-01-03,Battle of the Bastards,,https://x,TV Episode,9.9,60,2016,,,,";
const HEAT = "tt0113277,9,2026-01-02,Heat,,https://x,Movie,8.3,170,1995,,,,";

function summary(
  type: "MOVIE" | "SERIES",
  sourceId: string,
  title: string,
): MediaSummaryDto {
  return {
    source: "TMDB",
    sourceId,
    type,
    title,
    year: null,
    posterUrl: null,
  } as MediaSummaryDto;
}

type Found = Awaited<ReturnType<TmdbProvider["findByImdbId"]>>;
const nothing: Found = { movie: null, series: null, episode: null };

/** What TMDB's `/find` answers for each IMDb id. */
const TMDB: Record<string, Partial<Found>> = {
  tt0903747: { series: summary("SERIES", "1396", "Breaking Bad") },
  tt0959621: { episode: { seriesTmdbId: "1396", season: 5, episode: 14 } },
  tt2301451: { episode: { seriesTmdbId: "1396", season: 3, episode: 10 } },
  tt4283088: { episode: { seriesTmdbId: "1399", season: 6, episode: 9 } },
  tt0113277: { movie: summary("MOVIE", "949", "Heat") },
};

function makeSource(
  findByImdbId = vi.fn((id: string) =>
    Promise.resolve({ ...nothing, ...TMDB[id] }),
  ),
) {
  const getSeriesSummaryByTmdbId = vi.fn((id: string) =>
    Promise.resolve(summary("SERIES", id, `Série ${id}`)),
  );
  const resolveMovie = vi.fn();
  const resolveShow = vi.fn();
  const source = new ImdbImportSource(
    {} as unknown as PrismaService,
    {} as unknown as MediaItemService,
    { resolveMovie, resolveShow } as unknown as MediaMatchResolver,
    {} as unknown as ReviewService,
    {} as unknown as ListService,
    { findByImdbId, getSeriesSummaryByTmdbId } as unknown as TmdbProvider,
  );
  const progress: ProgressReporter & { total: number; done: number } = {
    total: 0,
    done: 0,
    setTotal(total) {
      this.total = total;
    },
    tick() {
      this.done++;
    },
  };

  const plan = (input: string) =>
    source.buildPlan("user-1", source.parseInput(input), progress);

  // `load` is the hook buildPlan calls before resolving anything; driven
  // directly where a test is about what it leaves on the parse model.
  const load = async (input: string) => {
    const parsed = source.parseInput(input);
    await (
      source as unknown as {
        load: (p: typeof parsed, r: ProgressReporter) => Promise<void>;
      }
    ).load(parsed, progress);
    return parsed;
  };

  return {
    source,
    plan,
    load,
    progress,
    findByImdbId,
    getSeriesSummaryByTmdbId,
    resolveMovie,
    resolveShow,
  };
}

describe("ImdbImportSource — rated episodes", () => {
  it("groups episodes of one series into a single show", async () => {
    const { load } = makeSource();
    const parsed = await load(ratings(OZYMANDIAS, FLY, BASTARDS));

    expect(parsed.shows).toHaveLength(2);
    const breakingBad = parsed.shows.find((s) => s.match?.sourceId === "1396");
    expect(breakingBad?.title).toBe("Série 1396");
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
    const { load } = makeSource();
    const parsed = await load(ratings(OZYMANDIAS));

    expect(parsed.shows[0].episodes[0].rating).toBe(10);
  });

  it("attaches episodes to the series row of the same export", async () => {
    // The series row only carries its IMDb id; its TMDB id comes from its
    // own lookup, which is what the episodes are matched against.
    const { plan, getSeriesSummaryByTmdbId } = makeSource();
    const result = await plan(ratings(BREAKING_BAD, OZYMANDIAS, FLY));

    const items = result.groups.flatMap((g) => g.items);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Breaking Bad",
      context: { kind: "series", episodesWatched: 2, rating: 10 },
    });
    expect(getSeriesSummaryByTmdbId).not.toHaveBeenCalled();
  });

  it("counts an episode TMDB cannot place as unresolved", async () => {
    const { plan } = makeSource(vi.fn(() => Promise.resolve(nothing)));
    const result = await plan(ratings(OZYMANDIAS, FLY));

    expect(result.groups).toEqual([]);
    expect(result.counts).toMatchObject({ total: 2, unresolved: 2 });
  });

  it("survives a lookup that throws", async () => {
    const { plan } = makeSource(
      vi.fn(() => Promise.reject(new Error("TMDB down"))),
    );

    await expect(plan(ratings(HEAT, OZYMANDIAS))).resolves.toMatchObject({
      counts: { unresolved: 2 },
    });
  });
});

describe("ImdbImportSource — matching", () => {
  it("matches by IMDb id only, never by a title search", async () => {
    const { plan, resolveMovie, resolveShow } = makeSource(
      vi.fn(() => Promise.resolve(nothing)),
    );
    const result = await plan(ratings(HEAT, BREAKING_BAD));

    expect(result.counts).toMatchObject({ total: 2, unresolved: 2 });
    expect(resolveMovie).not.toHaveBeenCalled();
    expect(resolveShow).not.toHaveBeenCalled();
  });

  it("files a title where TMDB has it, whatever IMDb's type says", async () => {
    const { plan } = makeSource(
      vi.fn(() =>
        Promise.resolve({
          ...nothing,
          series: summary("SERIES", "42", "Un spécial"),
        }),
      ),
    );
    const result = await plan(
      ratings(
        "tt9,8,2026-01-01,Un spécial,,https://x,TV Special,8,60,2020,,,,",
      ),
    );

    expect(result.groups.map((g) => g.id)).toEqual(["seriesTracked"]);
    expect(result.groups[0].items[0].match?.sourceId).toBe("42");
  });

  it("puts a rated series with the series being watched", async () => {
    const { plan } = makeSource();
    const result = await plan(ratings(BREAKING_BAD));

    expect(result.groups.map((g) => g.id)).toEqual(["seriesTracked"]);
    expect(result.groups[0].items[0].context).toMatchObject({
      episodesWatched: 0,
      status: "WATCHING",
    });
  });

  it("matches the titles of a list without tracking them", async () => {
    const { plan } = makeSource();
    const result = await plan(
      JSON.stringify([
        {
          name: "Polars.csv",
          text: [
            LIST_HEADER,
            "1,tt0113277,2025-06-01,2025-06-01,,Heat,,https://x,Movie,8.3,170,1995,,,,,,",
          ].join("\n"),
        },
      ]),
    );

    expect(result.groups.map((g) => g.id)).toEqual(["listFilms"]);
    expect(result.groups[0].items[0].match?.sourceId).toBe("949");
  });

  it("reports one progress bar from the lookups to the plan", async () => {
    const { plan, progress } = makeSource();
    await plan(ratings(HEAT, BREAKING_BAD, OZYMANDIAS, BASTARDS));

    // Four ids looked up, plus Game of Thrones' title (known only through
    // its episode); nothing is left for the plan to resolve.
    expect(progress.total).toBe(5);
    expect(progress.done).toBe(5);
  });
});

describe("ImdbImportSource — input", () => {
  it("reads several files sent as a JSON array", () => {
    const { source } = makeSource();
    const parsed = source.parseInput(
      JSON.stringify([
        { name: "ratings.csv", text: ratings(HEAT) },
        { name: "WATCHLIST.csv", text: `${LIST_HEADER}\n` },
      ]),
    );

    expect(parsed.movies).toHaveLength(1);
  });

  it("refuses a JSON payload that is not a list of files", () => {
    const { source } = makeSource();

    expect(() => source.parseInput('[{"name": 1}]')).toThrow(
      expect.objectContaining({ code: "import.malformed_export" }),
    );
  });
});
