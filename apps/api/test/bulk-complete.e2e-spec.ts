// Read at module init: the season XP below is only credited with it.
process.env.GAMIFICATION_ENABLED = "true";

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { authCookies, createE2eApp, type E2eApp, e2eUser } from "./e2e-app";

/**
 * Bulk "completed" on a series marks every aired regular episode in one pass
 * (audit 2026-11-14, PRF-02): the same outcome as ticking each season by
 * hand, without a full watch-and-sync round per season.
 */
describe("Bulk completion of a series (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: E2eApp["prisma"];
  let cookie = "";
  let userId = "";

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-bulk-complete"))
      .expect(201);
    cookie = authCookies(registered);
    userId = (
      await request(http).get("/api/users/me").set("Cookie", cookie).expect(200)
    ).body.id;
    // A new account picks its domains at onboarding.
    await prisma.user.update({
      where: { id: userId },
      data: { enabledDomains: ["MEDIA"] },
    });
  });

  afterAll(() => app.close());

  it("marks every aired regular episode, and only those", async () => {
    const item = await prisma.mediaItem.create({
      data: {
        type: "SERIES",
        canonicalSource: "TMDB",
        title: "Bulk complete",
        status: "Returning Series",
        externalIds: {
          create: {
            source: "TMDB",
            externalId: `bulk-complete-${Date.now()}`,
            type: "SERIES",
          },
        },
      },
    });
    const aired = new Date("2025-01-01T20:00:00Z");
    const future = new Date("2999-01-01T20:00:00Z");
    const seasons = [
      { number: 0, airDates: [aired] },
      { number: 1, airDates: [aired, aired] },
      { number: 2, airDates: [aired, future] },
    ];
    const ids: Record<string, string[]> = {};

    for (const { number, airDates } of seasons) {
      const season = await prisma.season.create({
        data: { mediaItemId: item.id, number },
      });
      ids[number] = [];

      for (const [i, airDate] of airDates.entries()) {
        const episode = await prisma.episode.create({
          data: { seasonId: season.id, number: i + 1, airDate },
        });
        ids[number].push(episode.id);
      }
    }

    const entry = await prisma.libraryEntry.create({
      data: { userId, mediaItemId: item.id, status: "WATCHING" },
    });

    const { body } = await request(http)
      .post("/api/library/entries/bulk")
      .set("Cookie", cookie)
      .send({ ids: [entry.id], status: "COMPLETED" })
      .expect(200);
    expect(body).toEqual({ updated: 1, skipped: 0 });

    const watched = (
      await prisma.episodeWatch.findMany({
        where: { userId },
        select: { episodeId: true },
      })
    ).map((watch) => watch.episodeId);
    // Season 1 in full, season 2's aired episode; no special, no future one.
    expect(watched.sort()).toEqual([...ids[1], ids[2][0]].sort());

    // Season 1 is complete: its XP was credited in the same pass.
    const season1 = await prisma.season.findFirstOrThrow({
      where: { mediaItemId: item.id, number: 1 },
    });
    expect(
      await prisma.xpEntry.count({
        where: {
          userId,
          reason: "SEASON_COMPLETED",
          sourceId: season1.id,
          revokedAt: null,
        },
      }),
    ).toBe(1);
  });
});
