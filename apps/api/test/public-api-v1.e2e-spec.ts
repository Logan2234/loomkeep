import { API_KEY_SCOPES } from "@loomkeep/shared";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import type { PrismaService } from "./../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * The public API read through a key, against a small library spread over
 * three domains: the cross-domain list, its normalised phases, and the
 * scope each resource demands.
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
      data: { enabledDomains: ["MEDIA", "GAMES", "BOOKS", "MUSIC"] },
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
    await prisma.libraryEntry.create({
      data: {
        userId,
        mediaItemId: movie.id,
        status: "COMPLETED",
        favorite: true,
        createdAt: new Date(Date.now() - 3 * DAY),
      },
    });
    const game = await prisma.gameItem.create({
      data: {
        canonicalSource: "IGDB",
        title: "Hades",
        externalIds: { create: { source: "IGDB", externalId: "113112" } },
      },
    });
    await prisma.gameEntry.create({
      data: {
        userId,
        gameItemId: game.id,
        status: "PLAYING",
        playtimeMinutes: 90,
        createdAt: new Date(Date.now() - 2 * DAY),
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
    await prisma.bookEntry.create({
      data: {
        userId,
        bookItemId: book.id,
        status: "READING",
        currentPage: 120,
        createdAt: new Date(Date.now() - DAY),
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

  it("holds each resource behind its own scope", async () => {
    await get("/api/v1/library", libraryKey).expect(200);
    await get("/api/v1/lists", libraryKey).expect(403);
    await get("/api/v1/stats/summary", libraryKey).expect(403);
    await get("/api/v1/export", libraryKey).expect(403);
  });
});
