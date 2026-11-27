// SOCIAL_ENABLED is read through ConfigService at module init, so it has to be
// set before the app is built: editors and list notifications only exist with
// Social on.
process.env.SOCIAL_ENABLED = "true";

import { ErrorCode } from "@loomkeep/shared/catalog";
import { ProfileAccess } from "@loomkeep/shared/enums";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import type { PrismaService } from "../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * A list shared with an editor, from invitation to block.
 *
 * Alice owns the list, Bob is her friend (mutual follow) and becomes its
 * editor, Carol is neither and only ever visits. The order is load-bearing:
 * each step builds on the previous one's state.
 */
describe("Collaborative lists (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;

  const users = {
    alice: e2eUser("e2e-list-alice"),
    bob: e2eUser("e2e-list-bob"),
    carol: e2eUser("e2e-list-carol"),
  };
  type Who = keyof typeof users;
  const session = {} as Record<Who, string>;
  const username = {} as Record<Who, string>;

  let listId: string;
  let workId: string;

  const as = (who: Who) => ({
    get: (url: string) => request(http).get(url).set("Cookie", session[who]),
    post: (url: string) => request(http).post(url).set("Cookie", session[who]),
    put: (url: string) => request(http).put(url).set("Cookie", session[who]),
    patch: (url: string) =>
      request(http).patch(url).set("Cookie", session[who]),
    delete: (url: string) =>
      request(http).delete(url).set("Cookie", session[who]),
  });

  async function listNotificationsOf(who: Who) {
    const res = await as(who)
      .get("/api/notifications/history?unread=true")
      .expect(200);
    return (
      res.body.items as {
        id: string;
        type: string;
        data: { itemTitle?: string };
      }[]
    ).filter((n) => n.type === "LIST_ITEM_ADDED");
  }

  function addWork(who: Who) {
    return as(who)
      .post(`/api/lists/${listId}/items`)
      .send({ targetType: "MEDIA", targetId: workId });
  }

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
      // Adding a work to a list takes its domain open to whoever adds it.
      await as(who)
        .patch("/api/users/me")
        .send({ enabledDomains: ["MEDIA"] })
        .expect(200);
    }

    // Friends: a mutual follow between two public profiles.
    await as("alice")
      .post(`/api/social/users/${username.bob}/follow`)
      .expect(201);
    await as("bob")
      .post(`/api/social/users/${username.alice}/follow`)
      .expect(201);

    // A work to put on the list: tracking it is what persists it.
    const tracked = await as("alice")
      .put("/api/media")
      .send({
        source: "ANILIST",
        sourceId: "4242",
        type: "ANIME",
        status: "PLANNED",
      })
      .expect(200);
    workId = tracked.body.mediaItem.id;

    const list = await as("alice")
      .post("/api/lists")
      .send({ title: "Shared", kind: "COLLECTION", visibility: "PUBLIC" })
      .expect(201);
    listId = list.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("offers only the owner's friends as editors", async () => {
    const res = await as("alice")
      .get(`/api/lists/${listId}/members/candidates`)
      .expect(200);

    const offered = res.body.map((u: { username: string }) => u.username);
    expect(offered).toContain(username.bob);
    expect(offered).not.toContain(username.carol);
  });

  it("refuses an editor who isn't a friend", async () => {
    const res = await as("alice")
      .post(`/api/lists/${listId}/members`)
      .send({ username: username.carol })
      .expect(403);

    expect(res.body.code).toBe("lists.member_not_friend");
  });

  it("adds a friend as editor, who then drops out of the candidates", async () => {
    await as("alice")
      .post(`/api/lists/${listId}/members`)
      .send({ username: username.bob })
      .expect(201);

    const res = await as("alice")
      .get(`/api/lists/${listId}/members/candidates`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("credits an item to whoever added it, for collaborators only", async () => {
    await addWork("bob").expect(201);

    const owner = await as("alice").get(`/api/lists/me/${listId}`).expect(200);
    expect(owner.body.collaborative).toBe(true);
    expect(owner.body.items[0].addedBy.username).toBe(username.bob);

    // A visitor learns neither that the list has editors nor who they are.
    const visitor = await as("carol").get(`/api/lists/${listId}`).expect(200);
    expect(visitor.body.collaborative).toBe(false);
    expect(visitor.body.items[0]).not.toHaveProperty("addedBy");
  });

  it("notifies the owner of the addition, and not the editor who made it", async () => {
    const aliceGot = await listNotificationsOf("alice");
    expect(aliceGot).toHaveLength(1);
    expect(aliceGot[0].data.itemTitle).toBe("Test Anime");

    expect(await listNotificationsOf("bob")).toHaveLength(0);
  });

  it("tells the owner again once they've read the previous addition", async () => {
    const [entry] = await listNotificationsOf("alice");
    await as("alice").patch(`/api/notifications/${entry.id}/read`).expect(204);
    expect(await listNotificationsOf("alice")).toHaveLength(0);

    const detail = await as("alice").get(`/api/lists/me/${listId}`).expect(200);
    await as("bob")
      .delete(`/api/lists/${listId}/items/${detail.body.items[0].id}`)
      .expect(200);
    await addWork("bob").expect(201);

    expect(await listNotificationsOf("alice")).toHaveLength(1);
  });

  it("stays quiet for a collaborator who muted the list", async () => {
    await as("alice").put(`/api/lists/${listId}/mute`).expect(200);
    const detail = await as("alice").get(`/api/lists/me/${listId}`).expect(200);
    expect(detail.body.notificationsMuted).toBe(true);

    // Taken off and put back: a new item, so it would notify again.
    await as("bob")
      .delete(`/api/lists/${listId}/items/${detail.body.items[0].id}`)
      .expect(200);
    await addWork("bob").expect(201);

    expect(await listNotificationsOf("alice")).toHaveLength(1);
  });

  it("takes the editor off the list once either side blocks", async () => {
    await as("alice")
      .post(`/api/social/users/${username.bob}/block`)
      .expect(201);

    await as("bob").get(`/api/lists/me/${listId}`).expect(403);

    // What Bob added stays on the list.
    const owner = await as("alice").get(`/api/lists/me/${listId}`).expect(200);
    expect(owner.body.collaborative).toBe(false);
    expect(owner.body.items).toHaveLength(1);
  });

  it("adds a work found by search without tracking it", async () => {
    await as("carol")
      .patch("/api/users/me")
      .send({ enabledDomains: ["MEDIA"] })
      .expect(200);
    const own = await as("carol")
      .post("/api/lists")
      .send({ title: "Un jour", kind: "COLLECTION", visibility: "PRIVATE" })
      .expect(201);

    await as("carol")
      .post(`/api/lists/${own.body.id}/works`)
      .send({ work: "/app/media/anime/7777" })
      .expect(201);
    await as("carol")
      .post(`/api/lists/${own.body.id}/works`)
      .send({ work: "/app/u/someone" })
      .expect(404);

    const detail = await as("carol")
      .get(`/api/lists/me/${own.body.id}`)
      .expect(200);
    expect(detail.body.items).toHaveLength(1);
    const library = await as("carol").get("/api/media").expect(200);
    expect(library.body.items).toEqual([]);
  });

  // The next position was read, then written, outside any lock: works added
  // at the same moment (two editors) shared one, and a ranked list's order
  // became arbitrary (audit 2026-11-17, BUG-35).
  it("gives works added at the same moment each their own position", async () => {
    const own = await as("alice")
      .post("/api/lists")
      .send({ title: "Rush", kind: "RANKED", visibility: "PRIVATE" })
      .expect(201);
    const works = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        prisma.mediaItem.create({
          data: {
            type: "MOVIE",
            canonicalSource: "TMDB",
            title: `Rush ${i}`,
            status: "Released",
            externalIds: {
              create: {
                source: "TMDB",
                externalId: `rush-${i}`,
                type: "MOVIE",
              },
            },
          },
        }),
      ),
    );

    await Promise.all(
      works.map((work) =>
        as("alice")
          .post(`/api/lists/${own.body.id}/items`)
          .send({ targetType: "MEDIA", targetId: work.id })
          .expect(201),
      ),
    );

    const items = await prisma.listItem.findMany({
      where: { listId: own.body.id },
      select: { position: true },
    });
    expect(new Set(items.map((i) => i.position)).size).toBe(works.length);
  });
  // A reorder used to write one UPDATE per item and check the item set
  // outside its transaction: a removal in between gave a 500 (audit
  // 2026-11-17, BUG-36 and PRF-04).
  it("reorders in one go, and refuses an order built before an item was removed", async () => {
    const own = await as("alice")
      .post("/api/lists")
      .send({ title: "Order", kind: "RANKED", visibility: "PRIVATE" })
      .expect(201);

    for (let i = 0; i < 3; i++) {
      const work = await prisma.mediaItem.create({
        data: {
          type: "MOVIE",
          canonicalSource: "TMDB",
          title: `Order ${i}`,
          status: "Released",
          externalIds: {
            create: { source: "TMDB", externalId: `order-${i}`, type: "MOVIE" },
          },
        },
      });
      await as("alice")
        .post(`/api/lists/${own.body.id}/items`)
        .send({ targetType: "MEDIA", targetId: work.id })
        .expect(201);
    }

    const loaded = await as("alice")
      .get(`/api/lists/${own.body.id}`)
      .expect(200);
    const ids = (loaded.body.items as { id: string }[]).map((i) => i.id);
    const reversed = [...ids].reverse();

    await as("alice")
      .put(`/api/lists/${own.body.id}/items/order`)
      .send({
        orderedItemIds: reversed,
        expectedUpdatedAt: loaded.body.updatedAt,
      })
      .expect(200);
    const after = await as("alice")
      .get(`/api/lists/${own.body.id}`)
      .expect(200);
    expect((after.body.items as { id: string }[]).map((i) => i.id)).toEqual(
      reversed,
    );

    await as("alice")
      .delete(`/api/lists/${own.body.id}/items/${reversed[0]}`)
      .expect(200);
    await as("alice")
      .put(`/api/lists/${own.body.id}/items/order`)
      .send({
        orderedItemIds: ids.slice(0, 2),
        expectedUpdatedAt: after.body.updatedAt,
      })
      .expect(409);
  });

  // Writes and list additions went through on a domain the user had turned
  // off (audit 2026-11-17, PRM-02 and PRM-06).
  it("refuses writes and list additions in a domain the user turned off", async () => {
    const refused = await as("alice")
      .put("/api/games")
      .send({ source: "IGDB", sourceId: "1", status: "PLAYING" })
      .expect(403);
    expect(refused.body.code).toBe(ErrorCode.UserDomainDisabled);

    await as("alice")
      .post(`/api/lists/${listId}/items`)
      .send({ targetType: "GAME", targetId: "any-game" })
      .expect(403);
  });
});
