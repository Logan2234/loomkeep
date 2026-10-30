// Read at module init: « Série et niveau » is null without it.
process.env.GAMIFICATION_ENABLED = "true";

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { authCookies, createE2eApp, type E2eApp, e2eUser } from "./e2e-app";

/**
 * The Android app's home-screen widgets (MOB-20): no session, only the token
 * the app handed them, valid while the app's session lasts.
 */
describe("Home-screen widgets (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: E2eApp["prisma"];

  let session = "";
  let userId = "";
  let token = "";
  let entryId = "";
  let gameEntryId = "";
  const episodeIds: string[] = [];

  const DAY = 24 * 60 * 60 * 1000;

  const feed = (widgetToken = token, include?: string) =>
    request(http)
      .get("/api/home-screen-widgets/feed")
      .query(include ? { include } : {})
      .set("X-Widget-Token", widgetToken);

  const timer = (step: string, body?: object) =>
    request(http)
      .post(`/api/home-screen-widgets/timer/${step}`)
      .query({ include: "timer" })
      .set("X-Widget-Token", token)
      .send(body ?? {});

  const watchNext = (episodeId: string) =>
    request(http)
      .post("/api/home-screen-widgets/watch-next")
      .set("X-Widget-Token", token)
      .send({ entryId, episodeId });

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-widget-viewer"))
      .expect(201);
    session = authCookies(registered);
    const me = await request(http)
      .get("/api/users/me")
      .set("Cookie", session)
      .expect(200);
    userId = me.body.id;
    await prisma.user.update({
      where: { id: userId },
      data: { enabledDomains: ["MEDIA", "GAMES"] },
    });

    // Three aired episodes, the first watched, and one airing next week.
    const show = await prisma.mediaItem.create({
      data: {
        type: "SERIES",
        canonicalSource: "TMDB",
        title: "Widget Show",
        externalIds: {
          create: { source: "TMDB", externalId: "widget-show", type: "SERIES" },
        },
      },
    });
    const season = await prisma.season.create({
      data: { mediaItemId: show.id, number: 1 },
    });

    for (const [number, airDate] of [
      [1, new Date(Date.now() - 30 * DAY)],
      [2, new Date(Date.now() - 20 * DAY)],
      [3, new Date(Date.now() - 10 * DAY)],
      [4, new Date(Date.now() + 7 * DAY)],
    ] as const) {
      const episode = await prisma.episode.create({
        data: { seasonId: season.id, number, airDate },
      });
      episodeIds.push(episode.id);
    }

    await prisma.episodeWatch.create({
      data: { userId, episodeId: episodeIds[0] },
    });
    ({ id: entryId } = await prisma.libraryEntry.create({
      data: { userId, mediaItemId: show.id, status: "WATCHING" },
    }));

    const game = await prisma.gameItem.create({
      data: {
        canonicalSource: "IGDB",
        title: "Widget Game",
        releaseDate: new Date(Date.now() - 400 * DAY),
        externalIds: { create: { source: "IGDB", externalId: "widget-game" } },
      },
    });
    ({ id: gameEntryId } = await prisma.gameEntry.create({
      data: { userId, gameItemId: game.id, status: "PLAYING" },
    }));

    ({
      body: { token },
    } = await request(http)
      .post("/api/home-screen-widgets/token")
      .set("Cookie", session)
      .expect(200));
  });

  afterAll(async () => {
    await app.close();
  });

  it("reads the next episode to watch and what airs next", async () => {
    const { body } = await feed().expect(200);

    expect(body.toWatch).toEqual([
      expect.objectContaining({
        entryId,
        title: "Widget Show",
        path: "/app/media/series/widget-show",
        next: { episodeId: episodeIds[1], seasonNumber: 1, episodeNumber: 2 },
        watchedEpisodes: 1,
      }),
    ]);
    expect(body.releases).toEqual([
      expect.objectContaining({
        kind: "EPISODE",
        title: "Widget Show",
        seasonNumber: 1,
        episodeNumber: 4,
      }),
    ]);
  });

  it("marks the next episode watched once, even from a widget drawn before", async () => {
    const { body } = await watchNext(episodeIds[1]).expect(200);
    expect(body.toWatch[0].next.episodeNumber).toBe(3);

    await watchNext(episodeIds[1]).expect(200);

    expect(
      await prisma.episodeWatch.count({
        where: { userId, episodeId: episodeIds[1] },
      }),
    ).toBe(1);
  });

  it("leaves out what no widget asked for", async () => {
    const { body } = await feed().expect(200);

    expect(body).toEqual(
      expect.objectContaining({
        timer: null,
        sessions: [],
        progression: null,
        added: [],
      }),
    );
  });

  it("runs the session timer from « Chrono » and saves the session", async () => {
    const started = await timer("start", {
      domain: "GAMES",
      entryId: gameEntryId,
    }).expect(200);
    expect(started.body.timer).toEqual(
      expect.objectContaining({
        domain: "GAMES",
        entryId: gameEntryId,
        title: "Widget Game",
        path: "/app/games/widget-game",
        paused: false,
      }),
    );

    const paused = await timer("pause").expect(200);
    expect(paused.body.timer.paused).toBe(true);

    await timer("resume").expect(200);
    const finished = await timer("finish").expect(200);

    expect(finished.body.timer).toBeNull();
    expect(finished.body.sessions).toEqual([
      expect.objectContaining({
        domain: "GAMES",
        entryId: gameEntryId,
        title: "Widget Game",
      }),
    ]);
    expect(await prisma.gameSession.count({ where: { gameEntryId } })).toBe(1);
  });

  it("reads the level, the streak and today's activity for « Série et niveau »", async () => {
    const { body } = await feed(token, "progression").expect(200);

    expect(body.progression).toEqual(
      expect.objectContaining({
        level: expect.any(Number),
        streakDays: expect.any(Number),
      }),
    );
    // The episode watched and the game played above, both today.
    expect(body.progression.activeDays).toContain(body.progression.today);
    expect(body.progression.streakDays).toBeGreaterThanOrEqual(1);
  });

  it("lists the latest additions across domains", async () => {
    const { body } = await feed(token, "added").expect(200);

    expect(body.added.map((added: { title: string }) => added.title)).toEqual([
      "Widget Game",
      "Widget Show",
    ]);
  });

  it("refuses a request without a valid token", async () => {
    const missing = await request(http)
      .get("/api/home-screen-widgets/feed")
      .expect(401);
    expect(missing.body.code).toBe("home_screen_widgets.token_invalid");

    await feed(`${token}x`).expect(401);
  });

  it("stops working once the app's session is signed out", async () => {
    await request(http)
      .post("/api/auth/logout")
      .set("Cookie", session)
      .expect((res) => expect(res.status).toBeLessThan(300));

    await feed().expect(401);
  });
});
