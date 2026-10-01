import { API_KEY_SCOPES } from "@loomkeep/shared";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import type { PrismaService } from "./../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * The public API read through a key, against a small library spread over
 * three domains: the cross-domain list, its normalised phases, the history,
 * title languages, and the scope each resource demands.
 */
describe("Public API v1 (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;
  let session: string;
  let fullKey: string;
  let libraryKey: string;

  const get = (url: string, key = fullKey) =>
    request(http).get(url).set("Authorization", `Bearer ${key}`);

  async function mintKey(scopes: readonly string[]): Promise<string> {
    const res = await request(http)
      .post("/api/api-keys")
      .set("Cookie", session)
      .send({ name: "e2e", scopes, expiresAt: null })
      .expect(201);
    return res.body.secret as string;
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-public-api"))
      .expect(201);
    session = authCookies(registered);
    const { id: userId } = (
      await request(http).get("/api/users/me").set("Cookie", session)
    ).body as { id: string };

    await prisma.user.update({
      where: { id: userId },
      data: {
        enabledDomains: ["MEDIA", "GAMES", "BOOKS", "MUSIC"],
        locale: "en",
      },
    });

    // createE2eApp only clears users and media: games and books from a
    // previous run would collide on their external ids.
    await prisma.gameItem.deleteMany({
      where: { externalIds: { some: { externalId: "113112" } } },
    });
    await prisma.bookItem.deleteMany({
      where: { externalIds: { some: { externalId: "OL893415W" } } },
    });

    const DAY = 86_400_000;
    const movie = await prisma.mediaItem.create({
      data: {
        type: "MOVIE",
        canonicalSource: "TMDB",
        title: "Arrival",
        externalIds: {
          create: { source: "TMDB", externalId: "329865", type: "MOVIE" },
        },
      },
    });
    await prisma.mediaItemTranslation.create({
      data: { mediaItemId: movie.id, locale: "fr", title: "Premier Contact" },
    });
    // Seen once on an unknown date (an import), then rewatched.
    const movieEntry = await prisma.libraryEntry.create({
      data: {
        userId,
        mediaItemId: movie.id,
        status: "COMPLETED",
        favorite: true,
        createdAt: new Date(Date.now() - 3 * DAY),
      },
    });
    await prisma.movieReplay.create({
      data: {
        libraryEntryId: movieEntry.id,
        finishedAt: new Date("2026-09-10T20:00:00Z"),
      },
    });
    const game = await prisma.gameItem.create({
      data: {
        canonicalSource: "IGDB",
        title: "Hades",
        externalIds: { create: { source: "IGDB", externalId: "113112" } },
      },
    });
    const gameEntry = await prisma.gameEntry.create({
      data: {
        userId,
        gameItemId: game.id,
        status: "PLAYING",
        playtimeMinutes: 90,
        createdAt: new Date(Date.now() - 2 * DAY),
      },
    });
    const playthrough = await prisma.gamePlaythrough.create({
      data: { gameEntryId: gameEntry.id, number: 1, status: "ACTIVE" },
    });
    await prisma.gameSession.create({
      data: {
        gameEntryId: gameEntry.id,
        playthroughId: playthrough.id,
        durationMinutes: 90,
        occurredAt: new Date("2026-09-20T18:00:00Z"),
      },
    });
    const book = await prisma.bookItem.create({
      data: {
        canonicalSource: "OPEN_LIBRARY",
        title: "Dune",
        authors: ["Frank Herbert"],
        pageCount: 600,
        externalIds: {
          create: { source: "OPEN_LIBRARY", externalId: "OL893415W" },
        },
      },
    });
    const bookEntry = await prisma.bookEntry.create({
      data: {
        userId,
        bookItemId: book.id,
        status: "READING",
        currentPage: 120,
        createdAt: new Date(Date.now() - DAY),
      },
    });
    await prisma.bookSession.create({
      data: {
        bookEntryId: bookEntry.id,
        durationMinutes: 40,
        pagesRead: 20,
        startPage: 100,
        endPage: 120,
        notes: "Arrakis",
        occurredAt: new Date("2026-09-30T21:00:00Z"),
      },
    });

    fullKey = await mintKey(API_KEY_SCOPES);
    libraryKey = await mintKey(["library:read"]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists every domain together, newest first", async () => {
    const res = await get("/api/v1/library").expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.hasMore).toBe(false);
    expect(
      res.body.items.map((e: { work: { title: string } }) => e.work.title),
    ).toEqual(["Dune", "Hades", "Arrival"]);
    expect(res.body.items[0]).toMatchObject({
      domain: "BOOKS",
      status: "READING",
      phase: "IN_PROGRESS",
      progress: { current: 120, total: 600, unit: "pages" },
      work: {
        creators: ["Frank Herbert"],
        source: "OPEN_LIBRARY",
        sourceId: "OL893415W",
      },
    });
  });

  it("pages across domains without losing or repeating an entry", async () => {
    const first = await get("/api/v1/library?limit=2").expect(200);
    const second = await get("/api/v1/library?limit=2&page=2").expect(200);

    expect(first.body.hasMore).toBe(true);
    expect(second.body.hasMore).toBe(false);
    expect(
      [...first.body.items, ...second.body.items].map(
        (e: { work: { title: string } }) => e.work.title,
      ),
    ).toEqual(["Dune", "Hades", "Arrival"]);
  });

  it("filters by normalised phase, domain and favourites", async () => {
    const inProgress = await get(
      "/api/v1/library?phase=IN_PROGRESS&sort=title",
    ).expect(200);
    expect(
      inProgress.body.items.map(
        (e: { work: { title: string } }) => e.work.title,
      ),
    ).toEqual(["Dune", "Hades"]);

    const games = await get("/api/v1/library?domain=GAMES").expect(200);
    expect(games.body.items).toHaveLength(1);
    expect(games.body.items[0].progress).toEqual({
      current: 90,
      total: null,
      unit: "minutes",
    });

    const favourites = await get("/api/v1/library?favorite=true").expect(200);
    expect(favourites.body.items).toEqual([
      expect.objectContaining({ domain: "MEDIA", phase: "DONE" }),
    ]);
  });

  it("rejects an unknown phase", async () => {
    await get("/api/v1/library?phase=SOMEDAY").expect(400);
  });

  it("reads one entry by id, whatever its domain", async () => {
    const list = await get("/api/v1/library?domain=GAMES").expect(200);
    const id = list.body.items[0].id as string;

    const res = await get(`/api/v1/library/${id}`).expect(200);
    expect(res.body.work.title).toBe("Hades");
    await get("/api/v1/library/not-an-entry").expect(404);
  });

  it("summarises the stats per domain and phase", async () => {
    const res = await get("/api/v1/stats/summary").expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.domains).toContainEqual({
      domain: "GAMES",
      total: 1,
      favorites: 0,
      byPhase: { PLANNED: 0, IN_PROGRESS: 1, DONE: 0, DROPPED: 0 },
    });
  });

  it("serves the other resources", async () => {
    await get("/api/v1/lists").expect(200);
    await get("/api/v1/calendar?days=30").expect(200);
    await get("/api/v1/reviews?domain=BOOKS").expect(200);
    await get("/api/v1/notifications").expect(200);
    const profile = await get("/api/v1/profile").expect(200);
    expect(profile.body.username).toBeTruthy();
  });

  it("merges the dated history of every domain, newest first", async () => {
    const res = await get("/api/v1/history").expect(200);

    expect(res.body.total).toBe(3);
    expect(
      res.body.items.map((e: { type: string; date: string }) => [
        e.type,
        e.date,
      ]),
    ).toEqual([
      ["BOOK_SESSION", "2026-09-30T21:00:00.000Z"],
      ["GAME_SESSION", "2026-09-20T18:00:00.000Z"],
      ["MOVIE_WATCHED", "2026-09-10T20:00:00.000Z"],
    ]);
    expect(res.body.items[0]).toMatchObject({
      work: { title: "Dune" },
      durationMinutes: 40,
      pages: { read: 20, from: 100, to: 120 },
      notes: "Arrakis",
    });
    expect(res.body.items[1].cycle).toBe(1);
    expect(res.body.items[2].cycle).toBe(2);
  });

  it("windows the history by date, a bare end date included", async () => {
    const september = await get(
      "/api/v1/history?from=2026-09-10&to=2026-09-20",
    ).expect(200);
    expect(september.body.items.map((e: { type: string }) => e.type)).toEqual([
      "GAME_SESSION",
      "MOVIE_WATCHED",
    ]);

    const games = await get("/api/v1/history?domain=GAMES").expect(200);
    expect(games.body.total).toBe(1);

    const paged = await get("/api/v1/history?limit=2&page=2").expect(200);
    expect(paged.body.items.map((e: { type: string }) => e.type)).toEqual([
      "MOVIE_WATCHED",
    ]);

    await get("/api/v1/history?from=2026-09-20&to=2026-09-10").expect(400);
    await get("/api/v1/history?from=yesterday").expect(400);
  });

  it("keeps an entry's undated viewings in its own history", async () => {
    const list = await get("/api/v1/library?domain=MEDIA").expect(200);
    const id = list.body.items[0].id as string;

    const res = await get(`/api/v1/library/${id}/history`).expect(200);
    expect(
      res.body.items.map((e: { cycle: number; date: string | null }) => [
        e.cycle,
        e.date,
      ]),
    ).toEqual([
      [2, "2026-09-10T20:00:00.000Z"],
      [1, null],
    ]);
    await get("/api/v1/library/not-an-entry/history").expect(404);
  });

  it("translates video titles into the asked or the account's language", async () => {
    const french = await get("/api/v1/library?domain=MEDIA&lang=fr").expect(
      200,
    );
    expect(french.body.items[0].work.title).toBe("Premier Contact");

    const history = await get("/api/v1/history?domain=MEDIA&lang=fr").expect(
      200,
    );
    expect(history.body.items[0].work.title).toBe("Premier Contact");

    const id = french.body.items[0].id as string;
    const { id: userId } = (
      await request(http).get("/api/users/me").set("Cookie", session)
    ).body as { id: string };
    await prisma.user.update({ where: { id: userId }, data: { locale: "fr" } });
    const byAccount = await get(`/api/v1/library/${id}`).expect(200);
    const forced = await get(`/api/v1/library/${id}?lang=en`).expect(200);
    await prisma.user.update({ where: { id: userId }, data: { locale: "en" } });

    expect(byAccount.body.work.title).toBe("Premier Contact");
    expect(forced.body.work.title).toBe("Arrival");
    await get("/api/v1/library?lang=de").expect(400);
  });

  it("holds each resource behind its own scope", async () => {
    await get("/api/v1/library", libraryKey).expect(200);
    await get("/api/v1/history", libraryKey).expect(200);
    await get("/api/v1/lists", libraryKey).expect(403);
    await get("/api/v1/stats/summary", libraryKey).expect(403);
    await get("/api/v1/export", libraryKey).expect(403);
  });

  // Last: it spends the account's whole budget for the minute.
  it("meters the account per minute and says so in the headers", async () => {
    const me = await get("/api/v1/me").expect(200);
    expect(me.body.rateLimit).toEqual({ perMinute: 60 });
    expect(me.headers["x-ratelimit-limit"]).toBe("60");

    let refused: request.Response | undefined;

    for (let i = 0; i < 61 && !refused; i++) {
      const res = await get("/api/v1/me", libraryKey);
      if (res.status === 429) refused = res;
    }

    expect(refused?.body.code).toBe("api.rate_limited");
    expect(Number(refused?.headers["retry-after"])).toBeGreaterThan(0);
    // The budget is the account's, shared by every key.
    await get("/api/v1/me").expect(429);
  });
});
