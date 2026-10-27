import { CatalogSource, MediaSource, MediaType } from "@loomkeep/shared";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import type { ProviderMediaDetails } from "../src/catalog/providers/provider.types";
import type { PrismaService } from "../src/prisma/prisma.service";
import {
  authCookies,
  createE2eApp,
  e2eUser,
  progressDrift,
  type E2eApp,
} from "./e2e-app";

const RATINGS_HEADER =
  "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors";
const LIST_HEADER =
  "Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated";

function summary(type: MediaType, sourceId: string, title: string) {
  return {
    source: CatalogSource.TMDB,
    sourceId,
    type,
    title,
    year: 2000,
    posterUrl: null,
    isAdult: false,
  };
}

/** TMDB as the stubs know it: two films (one still in post-production) and a series. */
const CATALOGUE = {
  heat: summary(MediaType.MOVIE, "949", "Heat"),
  festival: summary(MediaType.MOVIE, "777", "Festival Film"),
  breakingBad: summary(MediaType.SERIES, "1396", "Breaking Bad"),
};

function details(
  base: ReturnType<typeof summary>,
  status: string,
  episodes = 0,
): ProviderMediaDetails {
  return {
    summary: base,
    overview: null,
    backdropUrl: null,
    genres: [],
    status,
    format: null,
    releaseDate: null,
    movieReleaseDates: [],
    runtimeMin: 50,
    externalIds: [{ source: MediaSource.TMDB, externalId: base.sourceId }],
    seasons:
      episodes === 0
        ? []
        : [
            {
              number: 1,
              title: null,
              overview: null,
              posterUrl: null,
              airDate: null,
              voteAverage: null,
              episodes: Array.from({ length: episodes }, (_, i) => ({
                number: i + 1,
                title: `Episode ${i + 1}`,
                airDate: "2008-01-20",
                runtimeMin: 50,
                overview: null,
                stillUrl: null,
                voteAverage: null,
                voteCount: null,
                episodeType: null,
                streamingUrl: null,
                streamingSite: null,
              })),
            },
          ],
  };
}

/**
 * The IMDb import, end to end: several CSVs in one run, matched by IMDb id,
 * written over a library that already holds some of it — which it must add to
 * and never take away from.
 */
describe("IMDb import (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;
  let stubs: E2eApp["stubs"];
  const user = e2eUser("e2e-imdb");
  let cookies: string;
  let userId: string;

  async function settled(jobId: string) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = await request(http)
        .get(`/api/import/${jobId}`)
        .set("Cookie", cookies)
        .expect(200);
      if (res.body.status !== "running") return res.body;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Import job never settled");
  }

  /** Analyzes `input`, then commits every item of the plan. */
  async function importAll(input: string) {
    const started = await request(http)
      .post("/api/import/imdb/analyze")
      .set("Cookie", cookies)
      .send({ input })
      .expect(201);
    const analyzed = await settled(started.body.id);
    expect(analyzed.status).toBe("completed");

    const keys = analyzed.plan.groups.flatMap(
      (g: { items: { key: string }[] }) => g.items.map((i) => i.key),
    );
    const committed = await request(http)
      .post(`/api/import/imdb/${analyzed.id}/commit`)
      .set("Cookie", cookies)
      .send({ include: keys })
      .expect(201);
    const done = await settled(committed.body.id);
    expect(done.status).toBe("completed");
    return { plan: analyzed.plan, report: done.report };
  }

  async function entryOf(sourceId: string) {
    const ref = await prisma.mediaExternalId.findFirstOrThrow({
      where: { source: "TMDB", externalId: sourceId },
    });
    return prisma.libraryEntry.findUnique({
      where: {
        userId_mediaItemId: { userId, mediaItemId: ref.mediaItemId },
      },
    });
  }

  beforeAll(async () => {
    ({ app, http, prisma, stubs } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);
    cookies = authCookies(registered);
    await request(http)
      .patch("/api/users/me")
      .set("Cookie", cookies)
      .send({ enabledDomains: ["MEDIA"] })
      .expect(200);
    userId = (
      await prisma.user.findFirstOrThrow({ where: { email: user.email } })
    ).id;

    stubs.tmdb.findByImdbId.mockImplementation(async (id: string) => ({
      movie:
        id === "tt0113277"
          ? CATALOGUE.heat
          : id === "tt7777777"
            ? CATALOGUE.festival
            : null,
      series: id === "tt0903747" ? CATALOGUE.breakingBad : null,
      episode:
        id === "tt0959621"
          ? { seriesTmdbId: "1396", season: 1, episode: 2 }
          : null,
    }));
    stubs.tmdb.getDetails.mockImplementation(async (sourceId: string) =>
      sourceId === "949"
        ? details(CATALOGUE.heat, "Released")
        : sourceId === "777"
          ? details(CATALOGUE.festival, "Post Production")
          : details(CATALOGUE.breakingBad, "Ended", 3),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("adds to what the library holds and never takes it away", async () => {
    // A film the user already finished, dated and reviewed in Loomkeep.
    await importAll(
      [
        RATINGS_HEADER,
        "tt0113277,9,2026-01-02,Heat,,https://x,Movie,8.3,170,1995,,,,",
      ].join("\n"),
    );
    const heat = await entryOf("949");
    const finishedAt = new Date("2020-05-01T00:00:00Z");
    await prisma.libraryEntry.update({
      where: { id: heat!.id },
      data: { startedAt: finishedAt, finishedAt },
    });
    await prisma.review.update({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: "MEDIA",
          targetId: heat!.mediaItemId,
        },
      },
      data: { text: "Mon avis à moi" },
    });

    const { plan, report } = await importAll(
      JSON.stringify([
        {
          name: "ratings.csv",
          text: [
            RATINGS_HEADER,
            "tt0903747,10,2026-01-02,Breaking Bad,,https://x,tvSeries,9.5,49,2008,,,,",
            "tt0959621,7,2026-01-01,Cat's in the Bag...,,https://x,tvEpisode,8.2,48,2008,,,,",
            "tt7777777,8,2026-01-03,Festival Film,,https://x,movie,7,100,2026,,,,",
          ].join("\n"),
        },
        {
          name: "WATCHLIST.csv",
          text: [
            LIST_HEADER,
            "1,tt0113277,2026-02-01,2026-02-01,,Heat,,https://x,Movie,8.3,170,1995,,,,,,",
          ].join("\n"),
        },
        {
          name: "Polars.csv",
          text: [
            LIST_HEADER,
            "1,tt0113277,2026-02-01,2026-02-01,Le meilleur,Heat,,https://x,Movie,8.3,170,1995,,,,,,",
          ].join("\n"),
        },
      ]),
    );

    // One row per series, the episode folded into it.
    const titles = plan.groups.flatMap((g: { items: { title: string }[] }) =>
      g.items.map((i) => i.title),
    );
    expect(titles.filter((t: string) => t === "Breaking Bad")).toHaveLength(1);

    // The watchlist row neither sends Heat back to "planned" nor erases its
    // dates; the rating stays, and the user's own review text with it.
    const heatAfter = await entryOf("949");
    expect(heatAfter).toMatchObject({ status: "COMPLETED", finishedAt });
    const heatReview = await prisma.review.findFirstOrThrow({
      where: { userId, targetType: "MEDIA", targetId: heat!.mediaItemId },
    });
    expect(heatReview).toMatchObject({ rating: 9, text: "Mon avis à moi" });

    // Rated series: being watched, one episode of three in, both ratings
    // where they belong.
    const breakingBad = await entryOf("1396");
    expect(breakingBad).toMatchObject({
      status: "WATCHING",
      watchedEpisodes: 1,
    });
    const ratings = await prisma.review.findMany({
      where: { userId, targetType: { in: ["MEDIA", "EPISODE"] } },
      select: { targetType: true, rating: true },
    });
    expect(ratings).toEqual(
      expect.arrayContaining([
        { targetType: "EPISODE", rating: 7 },
        { targetType: "MEDIA", rating: 10 },
      ]),
    );

    // A film still in post-production cannot be finished or rated yet: it is
    // followed, and the rest of the import goes through.
    const festival = await entryOf("777");
    expect(festival).toMatchObject({ status: "PLANNED", finishedAt: null });
    expect(ratings).toHaveLength(3);

    // The list file is a list, not a watchlist, with the item's note.
    const lists = await prisma.list.findMany({
      where: { userId },
      include: { items: true },
    });
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ title: "Polars", kind: "COLLECTION" });
    expect(lists[0].items).toEqual([
      expect.objectContaining({
        targetId: heat!.mediaItemId,
        note: "Le meilleur",
        addedById: userId,
      }),
    ]);
    expect(report.tiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "lists", value: 1 }),
      ]),
    );

    expect(await progressDrift(prisma)).toMatchObject({ entries: 0, media: 0 });
  });
});
