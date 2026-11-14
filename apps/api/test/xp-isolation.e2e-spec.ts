// Read at module init: no XP is ever credited without it.
process.env.GAMIFICATION_ENABLED = "true";

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { authCookies, createE2eApp, type E2eApp, e2eUser } from "./e2e-app";

/**
 * Some XP sources are shared catalogue rows: SEASON_COMPLETED is anchored to
 * the Season itself, the same row for everyone who watches the show. Taking
 * one viewer's gain back must leave every other viewer's alone (audit
 * 2026-11-14, BUG-01: a single unwatched episode used to revoke it for all).
 */
describe("XP isolation between users (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: E2eApp["prisma"];

  const viewers = {
    a: { cookie: "", id: "", entryId: "" },
    b: { cookie: "", id: "", entryId: "" },
  };
  let seasonId = "";
  const episodeIds: string[] = [];

  const liveSeasonXp = (userId: string) =>
    prisma.xpEntry.count({
      where: {
        userId,
        reason: "SEASON_COMPLETED",
        sourceType: "Season",
        sourceId: seasonId,
        revokedAt: null,
      },
    });
  const score = async (userId: string) =>
    (await prisma.userScore.findUnique({ where: { userId } }))?.xp ?? 0;

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());

    for (const [key, viewer] of Object.entries(viewers)) {
      const registered = await request(http)
        .post("/api/auth/register")
        .send(e2eUser(`e2e-xp-isolation-${key}`))
        .expect(201);
      viewer.cookie = authCookies(registered);
      viewer.id = (
        await request(http)
          .get("/api/users/me")
          .set("Cookie", viewer.cookie)
          .expect(200)
      ).body.id;
    }

    const item = await prisma.mediaItem.create({
      data: {
        type: "SERIES",
        canonicalSource: "TMDB",
        title: "XP isolation",
        status: "Returning Series",
        externalIds: {
          create: {
            source: "TMDB",
            externalId: `xp-isolation-${Date.now()}`,
            type: "SERIES",
          },
        },
      },
    });
    const season = await prisma.season.create({
      data: { mediaItemId: item.id, number: 1 },
    });
    seasonId = season.id;

    for (const number of [1, 2]) {
      const episode = await prisma.episode.create({
        data: {
          seasonId,
          number,
          airDate: new Date("2025-01-0" + number + "T20:00:00Z"),
        },
      });
      episodeIds.push(episode.id);
    }

    for (const viewer of Object.values(viewers)) {
      const entry = await prisma.libraryEntry.create({
        data: { userId: viewer.id, mediaItemId: item.id, status: "WATCHING" },
      });
      viewer.entryId = entry.id;
      await request(http)
        .post(`/api/library/seasons/${seasonId}/watches`)
        .set("Cookie", viewer.cookie)
        .expect(204);
    }
  });

  afterAll(() => app.close());

  it("credits the finished season to each viewer", async () => {
    expect(await liveSeasonXp(viewers.a.id)).toBe(1);
    expect(await liveSeasonXp(viewers.b.id)).toBe(1);
  });

  it("revokes it only for the viewer who unwatches an episode", async () => {
    const scoreBefore = await score(viewers.a.id);

    await request(http)
      .delete(`/api/library/episodes/${episodeIds[0]}/watches`)
      .set("Cookie", viewers.b.cookie)
      .expect(204);

    expect(await liveSeasonXp(viewers.b.id)).toBe(0);
    expect(await liveSeasonXp(viewers.a.id)).toBe(1);
    expect(await score(viewers.a.id)).toBe(scoreBefore);
  });

  it("revokes it only for the viewer who removes the show", async () => {
    await request(http)
      .post(`/api/library/episodes/${episodeIds[0]}/watches`)
      .set("Cookie", viewers.b.cookie)
      .send({})
      .expect(201);
    expect(await liveSeasonXp(viewers.b.id)).toBe(1);
    const scoreBefore = await score(viewers.a.id);

    await request(http)
      .delete(`/api/library/entries/${viewers.b.entryId}`)
      .set("Cookie", viewers.b.cookie)
      .expect(204);

    expect(await liveSeasonXp(viewers.b.id)).toBe(0);
    expect(await liveSeasonXp(viewers.a.id)).toBe(1);
    expect(await score(viewers.a.id)).toBe(scoreBefore);
  });
});
