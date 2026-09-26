import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { BookLibraryService } from "./../src/books/book-library.service";
import { GameLibraryService } from "./../src/games/game-library.service";
import { LibraryService } from "./../src/library/library.service";
import { MusicLibraryService } from "./../src/music/music-library.service";
import type { PrismaService } from "./../src/prisma/prisma.service";
import { createE2eApp, e2eUser } from "./e2e-app";

/**
 * How the four library lists filter, sort and page, locked against a fixed
 * library: every sort in both directions, every filter, and pages that stitch
 * back into the whole list. The services are called directly — the
 * controllers only relay the query, and hundreds of requests would trip the
 * rate limit. The snapshots were taken before the listing moved
 * its filtering and paging into Postgres — they are the behaviour to keep.
 */
describe("Library listing (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;
  let userId: string;

  const DAY = 86_400_000;
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * DAY);
  // Distinct `updatedAt`s so ties break the same way on every run.
  let tick = 0;
  const touched = () => new Date(now - 1_000 * ++tick);

  type Filters = Record<string, unknown>;
  type Lister = (
    userId: string,
    filters: Filters,
  ) => Promise<{ items: object[]; total?: number; hasMore: boolean }>;

  const titleOf = (entry: object) => {
    const e = entry as Record<string, { title: string } | undefined>;
    return (e.mediaItem ?? e.game ?? e.book ?? e.album)!.title;
  };

  /** The whole list, and a check that 2-by-2 pages stitch back into it. */
  async function listing(list: Lister, filters: Filters): Promise<string[]> {
    const all = (await list(userId, { ...filters, limit: 100 })).items.map(
      titleOf,
    );
    const paged: string[] = [];

    for (let page = 1; ; page++) {
      const res = await list(userId, { ...filters, limit: 2, page });
      paged.push(...res.items.map(titleOf));
      expect(res.total).toBe(all.length);
      if (!res.hasMore) break;
    }

    expect(paged).toEqual(all);
    return all;
  }

  async function seedMedia() {
    const show = async (
      title: string,
      opts: {
        type?: "SERIES" | "ANIME" | "MOVIE";
        episodes?: number;
        watched?: number;
        lastWatched?: Date;
        airing?: string;
        status?: "PLANNED" | "COMPLETED" | "DROPPED" | "WATCHING";
        favorite?: boolean;
        rating?: number;
        french?: string;
        added: Date;
        started?: Date;
        finished?: Date;
      },
    ) => {
      const item = await prisma.mediaItem.create({
        data: {
          type: opts.type ?? "SERIES",
          canonicalSource: "TMDB",
          title,
          status: opts.airing ?? "Ended",
          externalIds: {
            create: {
              source: "TMDB",
              externalId: `m-${title}`,
              type: opts.type ?? "SERIES",
            },
          },
          ...(opts.french
            ? { translations: { create: { locale: "fr", title: opts.french } } }
            : {}),
        },
      });

      if (opts.episodes) {
        const season = await prisma.season.create({
          data: { mediaItemId: item.id, number: 1 },
        });
        // A special never counts towards progress.
        const specials = await prisma.season.create({
          data: { mediaItemId: item.id, number: 0 },
        });
        await prisma.episode.create({
          data: { seasonId: specials.id, number: 1 },
        });

        for (let n = 1; n <= opts.episodes; n++) {
          const episode = await prisma.episode.create({
            data: { seasonId: season.id, number: n },
          });

          if (n <= (opts.watched ?? 0)) {
            await prisma.episodeWatch.create({
              data: {
                userId,
                episodeId: episode.id,
                watchedAt: new Date(
                  (opts.lastWatched ?? daysAgo(1)).getTime() -
                    (opts.watched! - n),
                ),
              },
            });
          }
        }
      }

      await prisma.libraryEntry.create({
        data: {
          userId,
          mediaItemId: item.id,
          status: opts.status ?? "PLANNED",
          favorite: opts.favorite ?? false,
          createdAt: opts.added,
          updatedAt: touched(),
          startedAt: opts.started,
          finishedAt: opts.finished,
        },
      });

      if (opts.rating !== undefined) {
        await prisma.review.create({
          data: {
            userId,
            targetType: "MEDIA",
            targetId: item.id,
            rating: opts.rating,
          },
        });
      }
    };

    await show("Andor", {
      episodes: 12,
      watched: 5,
      lastWatched: daysAgo(2),
      airing: "Returning Series",
      favorite: true,
      rating: 9,
      french: "Andor (VF)",
      added: daysAgo(40),
      started: daysAgo(30),
    });
    await show("Dark", {
      episodes: 10,
      watched: 3,
      lastWatched: daysAgo(90),
      rating: 8,
      added: daysAgo(200),
      started: daysAgo(120),
    });
    await show("Severance", {
      episodes: 9,
      watched: 9,
      lastWatched: daysAgo(10),
      airing: "Returning Series",
      favorite: true,
      added: daysAgo(100),
      started: daysAgo(60),
    });
    await show("The Wire", {
      episodes: 13,
      watched: 13,
      lastWatched: daysAgo(300),
      rating: 10,
      french: "Sur écoute",
      added: daysAgo(400),
      started: daysAgo(350),
      finished: daysAgo(300),
    });
    await show("Frieren", {
      type: "ANIME",
      episodes: 28,
      added: daysAgo(5),
    });
    await show("Lost", {
      episodes: 20,
      watched: 4,
      status: "DROPPED",
      rating: 4,
      added: daysAgo(900),
    });
    await show("Arrival", {
      type: "MOVIE",
      status: "COMPLETED",
      rating: 9,
      favorite: true,
      added: daysAgo(50),
      finished: daysAgo(20),
    });
    await show("Dune", {
      type: "MOVIE",
      french: "Dune : première partie",
      added: daysAgo(3),
    });
    await show("saison 10", { type: "MOVIE", added: daysAgo(7) });
    await show("Saison 2", { type: "MOVIE", added: daysAgo(8) });
  }

  async function seedGames() {
    const game = async (
      title: string,
      opts: {
        status: "BACKLOG" | "PLAYING" | "COMPLETED" | "DROPPED";
        playtime?: number;
        favorite?: boolean;
        rating?: number;
        added: Date;
        started?: Date;
        finished?: Date;
      },
    ) => {
      const item = await prisma.gameItem.create({
        data: {
          canonicalSource: "IGDB",
          title,
          externalIds: { create: { source: "IGDB", externalId: `g-${title}` } },
        },
      });
      await prisma.gameEntry.create({
        data: {
          userId,
          gameItemId: item.id,
          status: opts.status,
          favorite: opts.favorite ?? false,
          playtimeMinutes: opts.playtime ?? 0,
          createdAt: opts.added,
          updatedAt: touched(),
          startedAt: opts.started,
          finishedAt: opts.finished,
        },
      });

      if (opts.rating !== undefined) {
        await prisma.review.create({
          data: {
            userId,
            targetType: "GAME",
            targetId: item.id,
            rating: opts.rating,
          },
        });
      }
    };

    await game("Hades II", {
      status: "PLAYING",
      playtime: 1200,
      favorite: true,
      rating: 9,
      added: daysAgo(10),
      started: daysAgo(9),
    });
    await game("Balatro", {
      status: "COMPLETED",
      playtime: 3000,
      rating: 8,
      added: daysAgo(100),
      started: daysAgo(90),
      finished: daysAgo(60),
    });
    await game("Celeste", {
      status: "COMPLETED",
      playtime: 600,
      favorite: true,
      added: daysAgo(300),
      finished: daysAgo(200),
    });
    await game("Elden Ring", { status: "BACKLOG", added: daysAgo(5) });
    await game("Anthem", {
      status: "DROPPED",
      playtime: 120,
      rating: 3,
      added: daysAgo(700),
    });
    await game("Hollow Knight", {
      status: "PLAYING",
      playtime: 600,
      added: daysAgo(20),
      started: daysAgo(15),
    });
  }

  async function seedBooks() {
    const book = async (
      title: string,
      opts: {
        status: "TO_READ" | "READING" | "READ" | "DROPPED";
        author?: string;
        pages?: number;
        currentPage?: number;
        favorite?: boolean;
        rating?: number;
        added: Date;
        started?: Date;
        finished?: Date;
      },
    ) => {
      const item = await prisma.bookItem.create({
        data: {
          canonicalSource: "OPEN_LIBRARY",
          title,
          authors: opts.author ? [opts.author] : [],
          pageCount: opts.pages,
          externalIds: {
            create: { source: "OPEN_LIBRARY", externalId: `b-${title}` },
          },
        },
      });
      await prisma.bookEntry.create({
        data: {
          userId,
          bookItemId: item.id,
          status: opts.status,
          favorite: opts.favorite ?? false,
          currentPage: opts.currentPage ?? 0,
          createdAt: opts.added,
          updatedAt: touched(),
          startedAt: opts.started,
          finishedAt: opts.finished,
        },
      });

      if (opts.rating !== undefined) {
        await prisma.review.create({
          data: {
            userId,
            targetType: "BOOK",
            targetId: item.id,
            rating: opts.rating,
          },
        });
      }
    };

    await book("Dune", {
      status: "READING",
      author: "Frank Herbert",
      pages: 600,
      currentPage: 300,
      favorite: true,
      rating: 9,
      added: daysAgo(15),
      started: daysAgo(12),
    });
    await book("Circe", {
      status: "READ",
      author: "Madeline Miller",
      pages: 400,
      currentPage: 400,
      rating: 8,
      added: daysAgo(200),
      started: daysAgo(190),
      finished: daysAgo(150),
    });
    await book("Project Hail Mary", {
      status: "READING",
      author: "Andy Weir",
      pages: 480,
      currentPage: 48,
      added: daysAgo(30),
      started: daysAgo(25),
    });
    await book("Ulysses", {
      status: "TO_READ",
      author: "James Joyce",
      added: daysAgo(3),
    });
    await book("Dracula", {
      status: "DROPPED",
      author: "Bram Stoker",
      pages: 0,
      currentPage: 20,
      rating: 5,
      added: daysAgo(500),
    });
    await book("Éloge de l'ombre", {
      status: "READ",
      pages: 120,
      currentPage: 120,
      favorite: true,
      added: daysAgo(80),
      finished: daysAgo(70),
    });
  }

  async function seedMusic() {
    const album = async (
      title: string,
      opts: {
        status: "TO_LISTEN" | "LISTENED";
        artist?: string;
        favorite?: boolean;
        rating?: number;
        added: Date;
        finished?: Date;
      },
    ) => {
      const item = await prisma.musicItem.create({
        data: {
          canonicalSource: "MUSICBRAINZ",
          title,
          artists: opts.artist ? [opts.artist] : [],
          externalIds: {
            create: { source: "MUSICBRAINZ", externalId: `a-${title}` },
          },
        },
      });
      await prisma.musicEntry.create({
        data: {
          userId,
          musicItemId: item.id,
          status: opts.status,
          favorite: opts.favorite ?? false,
          createdAt: opts.added,
          updatedAt: touched(),
          finishedAt: opts.finished,
        },
      });

      if (opts.rating !== undefined) {
        await prisma.review.create({
          data: {
            userId,
            targetType: "MUSIC",
            targetId: item.id,
            rating: opts.rating,
          },
        });
      }
    };

    await album("Kid A", {
      status: "LISTENED",
      artist: "Radiohead",
      favorite: true,
      rating: 10,
      added: daysAgo(60),
      finished: daysAgo(50),
    });
    await album("Blonde", {
      status: "TO_LISTEN",
      artist: "Frank Ocean",
      added: daysAgo(4),
    });
    await album("Discovery", {
      status: "LISTENED",
      artist: "Daft Punk",
      rating: 8,
      added: daysAgo(300),
      finished: daysAgo(10),
    });
    await album("Abbey Road", {
      status: "TO_LISTEN",
      artist: "The Beatles",
      added: daysAgo(90),
    });
    await album("Ágætis byrjun", {
      status: "LISTENED",
      favorite: true,
      added: daysAgo(20),
      finished: daysAgo(15),
    });
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    await prisma.gameItem.deleteMany();
    await prisma.bookItem.deleteMany();
    await prisma.musicItem.deleteMany();

    const user = e2eUser("e2e-library-listing");
    await request(http).post("/api/auth/register").send(user).expect(201);
    const me = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
      select: { id: true },
    });
    userId = me.id;
    await seedMedia();
    await seedGames();
    await seedBooks();
    await seedMusic();
  });

  afterAll(async () => {
    await app.close();
  });

  const LISTS: {
    name: string;
    list: () => Lister;
    sorts: string[];
    filters: Filters[];
  }[] = [
    {
      name: "media",
      list: () => (u, f) => app.get(LibraryService).listEntries(u, f),
      sorts: [
        "recent",
        "added",
        "title",
        "rating",
        "progress",
        "finished",
        "started",
        "status",
      ],
      filters: [
        {},
        { favorite: true },
        { q: "an" },
        { q: "%" },
        { types: ["MOVIE"] },
        { types: ["SERIES", "ANIME"] },
        { statuses: ["WATCHING"] },
        { statuses: ["DORMANT"] },
        { statuses: ["PLANNED"] },
        { statuses: ["COMPLETED", "UP_TO_DATE"] },
        { statuses: ["DROPPED"] },
        { lang: "fr" },
        { lang: "fr", q: "cou" },
      ],
    },
    {
      name: "games",
      list: () => (u, f) => app.get(GameLibraryService).listEntries(u, f),
      sorts: [
        "added",
        "title",
        "rating",
        "playtime",
        "finished",
        "started",
        "status",
      ],
      filters: [
        {},
        { favorite: true },
        { q: "ho" },
        { q: "%" },
        { statuses: ["PLAYING"] },
        { statuses: ["COMPLETED", "DROPPED"] },
        { statuses: ["PLAYING"], favorite: true },
      ],
    },
    {
      name: "books",
      list: () => (u, f) => app.get(BookLibraryService).listEntries(u, f),
      sorts: [
        "added",
        "title",
        "author",
        "rating",
        "pages",
        "progress",
        "finished",
        "started",
        "status",
      ],
      filters: [
        {},
        { favorite: true },
        { q: "d" },
        { q: "%" },
        { statuses: ["READING"] },
        { statuses: ["READ"], favorite: true },
      ],
    },
    {
      name: "music",
      list: () => (u, f) => app.get(MusicLibraryService).listEntries(u, f),
      sorts: ["added", "title", "artist", "rating", "finished", "status"],
      filters: [
        {},
        { favorite: true },
        { q: "b" },
        { q: "%" },
        { statuses: ["LISTENED"] },
      ],
    },
  ];

  for (const { name, list, sorts, filters } of LISTS) {
    it(`filters, sorts both ways and pages the ${name} library consistently`, async () => {
      const lister = list();
      const results: Record<string, string[]> = {};

      for (const filter of filters) {
        results[JSON.stringify(filter)] = await listing(lister, filter);
      }

      for (const sort of [...sorts, "unknown"]) {
        for (const order of ["desc", "asc"]) {
          results[`${sort} ${order}`] = await listing(lister, { sort, order });
        }
      }

      results["title asc, favorites, fr"] = await listing(lister, {
        sort: "title",
        order: "asc",
        favorite: true,
        lang: "fr",
      });

      expect(results).toMatchSnapshot();
    });
  }
});
