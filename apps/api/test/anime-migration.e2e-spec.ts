import type { INestApplication } from "@nestjs/common";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import type { App } from "supertest/types";
import { AnimeMigrationService } from "../src/catalog/anime-migration.service";
import type { ProviderMediaDetails } from "../src/catalog/providers/provider.types";
import { PrismaService } from "../src/prisma/prisma.service";
import { type E2eApp, createE2eApp, e2eUser, progressDrift } from "./e2e-app";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** TMDB's Frieren: season 1 runs on into the second cour, episode 29 on. */
const FRIEREN_TMDB: ProviderMediaDetails = {
  summary: {
    source: "TMDB",
    sourceId: "209867",
    type: "ANIME",
    title: "Frieren: Beyond Journey's End",
    originalTitle: "葬送のフリーレン",
    year: 2023,
    posterUrl: null,
    isAdult: false,
  },
  overview: null,
  backdropUrl: null,
  genres: ["Animation"],
  status: "Returning Series",
  format: null,
  releaseDate: "2023-09-29",
  runtimeMin: 24,
  externalIds: [{ source: "TMDB", externalId: "209867" }],
  seasons: [
    {
      number: 1,
      title: "Season 1",
      overview: null,
      posterUrl: null,
      airDate: "2023-09-29",
      voteAverage: null,
      episodes: [
        ...Array.from({ length: 28 }, (_, i) => ({
          number: i + 1,
          airDate: "2023-09-29",
        })),
        { number: 29, airDate: "2026-01-16" },
        { number: 30, airDate: "2026-01-23" },
      ].map((e) => ({
        ...e,
        title: null,
        runtimeMin: 24,
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

const YOUR_NAME_TMDB: ProviderMediaDetails = {
  summary: {
    source: "TMDB",
    sourceId: "372058",
    type: "MOVIE",
    title: "Your Name.",
    originalTitle: "君の名は。",
    year: 2016,
    posterUrl: null,
    isAdult: false,
  },
  overview: null,
  backdropUrl: null,
  genres: ["Animation"],
  status: "Released",
  format: null,
  releaseDate: "2016-08-26",
  movieReleaseDates: [],
  runtimeMin: 106,
  externalIds: [{ source: "TMDB", externalId: "372058" }],
  seasons: [],
};

/**
 * The one-off move of AniList anime onto TMDB, against a real database: the
 * entries, watches and reviews must land on the TMDB work, with the
 * progress triggers agreeing, and a dry run must write nothing.
 */
describe("Anime migration (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let stubs: E2eApp["stubs"];
  let userId: string;
  let frierenId: string;
  let yourNameId: string;

  beforeAll(async () => {
    let http: App;
    ({ app, http, prisma, stubs } = await createE2eApp());
    const user = e2eUser("e2e-anime-migration");
    await request(http).post("/api/auth/register").send(user).expect(201);
    userId = (
      await prisma.user.findFirstOrThrow({ where: { email: user.email } })
    ).id;

    process.env.BACKUP_DIR = await mkdtemp(join(tmpdir(), "anime-migration-"));
    stubs.tmdb.search.mockResolvedValue([
      FRIEREN_TMDB.summary,
      YOUR_NAME_TMDB.summary,
    ]);
    stubs.tmdb.getDetails.mockImplementation(async (sourceId: string) =>
      sourceId === "372058" ? YOUR_NAME_TMDB : FRIEREN_TMDB,
    );

    const frieren = await prisma.mediaItem.create({
      data: {
        type: "ANIME",
        canonicalSource: "ANILIST",
        title: "Frieren: Beyond Journey's End Season 2",
        format: "TV",
        releaseDate: day("2026-01-16"),
        externalIds: {
          create: { source: "ANILIST", externalId: "182255", type: "ANIME" },
        },
        seasons: {
          create: {
            number: 1,
            episodes: {
              create: [
                { number: 1, airDate: new Date("2026-01-16T14:00:00Z") },
                { number: 2, airDate: new Date("2026-01-23T14:00:00Z") },
              ],
            },
          },
        },
      },
      include: { seasons: { include: { episodes: true } } },
    });
    frierenId = frieren.id;
    await prisma.libraryEntry.create({
      data: { userId, mediaItemId: frieren.id, status: "WATCHING" },
    });
    await prisma.episodeWatch.createMany({
      data: frieren.seasons[0].episodes.map((e) => ({
        userId,
        episodeId: e.id,
        watchedAt: new Date("2026-02-01T20:00:00Z"),
      })),
    });
    await prisma.review.create({
      data: { userId, targetType: "MEDIA", targetId: frieren.id, rating: 9 },
    });

    const yourName = await prisma.mediaItem.create({
      data: {
        type: "ANIME",
        canonicalSource: "ANILIST",
        title: "Your Name.",
        format: "MOVIE",
        releaseDate: day("2016-08-26"),
        externalIds: {
          create: { source: "ANILIST", externalId: "21519", type: "ANIME" },
        },
        seasons: {
          create: { number: 1, episodes: { create: { number: 1 } } },
        },
      },
      include: { seasons: { include: { episodes: true } } },
    });
    yourNameId = yourName.id;
    await prisma.libraryEntry.create({
      data: { userId, mediaItemId: yourName.id, status: "COMPLETED" },
    });
    await prisma.episodeWatch.create({
      data: {
        userId,
        episodeId: yourName.seasons[0].episodes[0].id,
        watchedAt: new Date("2025-06-01T20:00:00Z"),
      },
    });
  });

  afterAll(async () => {
    delete process.env.BACKUP_DIR;
    await app.close();
  });

  it("only reports on a dry run", async () => {
    const file = await app.get(AnimeMigrationService).run("dry-run");
    const report = JSON.parse(await readFile(file, "utf8"));

    expect(report.summary).toMatchObject({
      anilistWorks: 2,
      placeable: 2,
      unresolved: 0,
    });
    await expect(
      prisma.mediaItem.count({ where: { canonicalSource: "ANILIST" } }),
    ).resolves.toBe(2);
  });

  it("moves a cour onto the episodes TMDB files it under", async () => {
    await app.get(AnimeMigrationService).run("apply");

    await expect(
      prisma.mediaItem.count({
        where: { id: { in: [frierenId, yourNameId] } },
      }),
    ).resolves.toBe(0);

    const entry = await prisma.libraryEntry.findFirstOrThrow({
      where: { userId, mediaItem: { type: "ANIME" } },
      include: { mediaItem: { include: { externalIds: true } } },
    });
    expect(entry.mediaItem.canonicalSource).toBe("TMDB");
    expect(entry.watchedEpisodes).toBe(2);
    expect(
      entry.mediaItem.externalIds.map((e) => [e.source, e.externalId]),
    ).toEqual(
      expect.arrayContaining([
        ["TMDB", "209867"],
        ["ANILIST", "182255"],
      ]),
    );

    const watched = await prisma.episodeWatch.findMany({
      where: {
        userId,
        episode: { season: { mediaItemId: entry.mediaItemId } },
      },
      select: { episode: { select: { number: true } } },
    });
    expect(watched.map((w) => w.episode.number).sort()).toEqual([29, 30]);

    await expect(
      prisma.review.findFirst({ where: { userId, rating: 9 } }),
    ).resolves.toMatchObject({
      targetType: "MEDIA",
      targetId: entry.mediaItemId,
    });
  });

  it("moves a film onto the TMDB film, its status saying it was seen", async () => {
    const entry = await prisma.libraryEntry.findFirstOrThrow({
      where: { userId, mediaItem: { type: "MOVIE" } },
      include: { mediaItem: true },
    });

    expect(entry.status).toBe("COMPLETED");
    expect(entry.mediaItem.title).toBe("Your Name.");
    await expect(progressDrift(prisma)).resolves.toMatchObject({
      entries: 0,
      media: 0,
    });
  });
});
