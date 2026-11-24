import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import type { PrismaService } from "./../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * A viewing dated in 2099 pinned the show at the top of "recent" for good,
 * and undo's restore wrote viewings of episodes not out yet (audit
 * 2026-11-17, BUG-53).
 */
describe("Episode watch bounds (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;
  let cookie: string;
  let aired: string;
  let upcoming: string;

  const post = (url: string) => request(http).post(url).set("Cookie", cookie);

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-watch-bounds"))
      .expect(201);
    cookie = authCookies(registered);
    const userId = (
      await request(http).get("/api/users/me").set("Cookie", cookie).expect(200)
    ).body.id;

    const item = await prisma.mediaItem.create({
      data: {
        type: "SERIES",
        canonicalSource: "TMDB",
        title: "Bounds",
        status: "Returning Series",
        externalIds: {
          create: { source: "TMDB", externalId: "bounds-1", type: "SERIES" },
        },
      },
    });
    const season = await prisma.season.create({
      data: { mediaItemId: item.id, number: 1 },
    });
    aired = (
      await prisma.episode.create({
        data: {
          seasonId: season.id,
          number: 1,
          airDate: new Date("2024-01-01"),
        },
      })
    ).id;
    upcoming = (
      await prisma.episode.create({
        data: {
          seasonId: season.id,
          number: 2,
          airDate: new Date("2099-01-01"),
        },
      })
    ).id;
    await prisma.libraryEntry.create({
      data: { userId, mediaItemId: item.id, status: "PLANNED" },
    });
  });

  afterAll(() => app.close());

  it("refuses a viewing dated in the future", async () => {
    await post(`/api/library/episodes/${aired}/watches`)
      .send({ watchedAt: "2099-01-01T00:00:00Z" })
      .expect(400);
  });

  it("still takes a viewing dated later today in another time zone", async () => {
    const tonight = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    await post(`/api/library/episodes/${aired}/watches`)
      .send({ watchedAt: tonight })
      .expect(201);
  });

  it("refuses to restore a viewing of an episode not out yet", async () => {
    const res = await post("/api/library/episodes/watches/undo")
      .send({ restore: [{ episodeId: upcoming, watchedAt: null }] })
      .expect(400);
    expect(res.body.code).toBe("library.episode_not_aired");
  });

  it("refuses to restore a viewing dated in the future", async () => {
    await post("/api/library/episodes/watches/undo")
      .send({
        restore: [{ episodeId: aired, watchedAt: "2099-01-01T00:00:00Z" }],
      })
      .expect(400);
  });
});
