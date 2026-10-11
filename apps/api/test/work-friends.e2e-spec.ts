// SOCIAL_ENABLED is read through ConfigService at module init, so it has to be
// set before the app is built.
process.env.SOCIAL_ENABLED = "true";

import { ProfileAccess } from "@loomkeep/shared";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaService } from "../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * A work's friends, as its page shows them: who the viewer's friends are,
 * what their library visibility lets through, how far they got (derived from
 * the episodes seen) and the rating of a review they published.
 */
describe("Friends on a work (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;

  const users = {
    alice: e2eUser("e2e-wf-alice"),
    bob: e2eUser("e2e-wf-bob"),
    carol: e2eUser("e2e-wf-carol"),
  };
  type Who = keyof typeof users;
  const session = {} as Record<Who, string>;
  const username = {} as Record<Who, string>;
  let itemId: string;

  const as = (who: Who) => ({
    get: (url: string) => request(http).get(url).set("Cookie", session[who]),
    post: (url: string) => request(http).post(url).set("Cookie", session[who]),
    put: (url: string) => request(http).put(url).set("Cookie", session[who]),
    patch: (url: string) =>
      request(http).patch(url).set("Cookie", session[who]),
  });

  const friendsOf = (who: Who) =>
    as(who)
      .get(`/api/social/works/MEDIA/${itemId}/friends`)
      .expect(200)
      .then((res) => res.body);

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());

    for (const who of Object.keys(users) as Who[]) {
      const registered = await request(http)
        .post("/api/auth/register")
        .send(users[who])
        .expect(201);
      session[who] = authCookies(registered);
      username[who] = (
        await as(who).get("/api/users/me").expect(200)
      ).body.username;
      await as(who)
        .patch("/api/social/me/privacy")
        .send({ profileAccess: ProfileAccess.PUBLIC })
        .expect(200);
      await as(who)
        .patch("/api/users/me")
        .send({ enabledDomains: ["MEDIA"] })
        .expect(200);
      const entry = await as(who)
        .put("/api/library")
        .send({
          source: "ANILIST",
          sourceId: "4242",
          type: "ANIME",
          status: "PLANNED",
        })
        .expect(200);
      itemId = entry.body.mediaItem.id;
    }

    // Alice and Bob are friends; Carol only follows Alice.
    await as("alice")
      .post(`/api/social/users/${username.bob}/follow`)
      .expect(201);
    await as("bob")
      .post(`/api/social/users/${username.alice}/follow`)
      .expect(201);
    await as("carol")
      .post(`/api/social/users/${username.alice}/follow`)
      .expect(201);

    const first = await prisma.episode.findFirstOrThrow({
      where: { number: 1, season: { number: 1, mediaItemId: itemId } },
      select: { id: true },
    });
    await as("bob")
      .post(`/api/library/episodes/${first.id}/watches`)
      .send({})
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists a friend where they stand, and the viewer among them", async () => {
    const body = await friendsOf("alice");

    expect(body.friends).toEqual([
      expect.objectContaining({
        user: expect.objectContaining({ username: username.bob }),
        status: "WATCHING",
        season: 1,
        episode: 1,
        rating: null,
      }),
    ]);
    expect(body.me).toEqual(expect.objectContaining({ status: "PLANNED" }));
    expect(body.seasons).toEqual([3]);
  });

  it("shows the rating of a review the friend published", async () => {
    await as("bob")
      .put(`/api/reviews/me/MEDIA/${itemId}`)
      .send({ rating: 8, visibility: "FRIENDS" })
      .expect(200);

    const body = await friendsOf("alice");

    expect(body.friends[0]).toEqual(expect.objectContaining({ rating: 8 }));
  });

  it("leaves out a friend who keeps their library to themselves", async () => {
    await as("bob")
      .patch("/api/social/me/privacy")
      .send({
        settings: [{ domain: "MEDIA", facet: "LIBRARY", audience: "NONE" }],
      })
      .expect(200);

    expect((await friendsOf("alice")).friends).toEqual([]);
  });
});
