import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { authCookies, createE2eApp, e2eUser, type E2eApp } from "./e2e-app";

/**
 * The AniList import, end to end: a user name in, a reviewable plan whose
 * titles need no matching (AniList is the anime catalogue), the entry out.
 */
describe("AniList import (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let stubs: E2eApp["stubs"];
  const user = e2eUser("e2e-anilist");
  let cookies: string;

  async function settled(jobId: string) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = await request(http)
        .get(`/api/import/anilist/${jobId}`)
        .set("Cookie", cookies)
        .expect(200);
      if (res.body.status !== "running") return res.body;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Import job never settled");
  }

  beforeAll(async () => {
    ({ app, http, stubs } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);
    cookies = authCookies(registered);
    await request(http)
      .patch("/api/users/me")
      .set("Cookie", cookies)
      .send({ enabledDomains: ["MEDIA"] })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it("imports a user's list, matched as is, with its progress and score", async () => {
    const started = await request(http)
      .post("/api/import/anilist/analyze")
      .set("Cookie", cookies)
      .send({ input: "https://anilist.co/user/Josh/animelist" })
      .expect(201);
    const analyzed = await settled(started.body.id);

    expect(analyzed.status).toBe("completed");
    expect(stubs.anilist.getUserAnimeList).toHaveBeenCalledWith("Josh");
    const items = analyzed.plan.groups.flatMap(
      (g: { items: { key: string; match: unknown }[] }) => g.items,
    );
    expect(items).toHaveLength(1);
    expect(items[0].match).toMatchObject({
      source: "ANILIST",
      sourceId: "4242",
    });

    const committed = await request(http)
      .post(`/api/import/anilist/${analyzed.id}/commit`)
      .set("Cookie", cookies)
      .send({ include: items.map((i: { key: string }) => i.key) })
      .expect(201);
    expect((await settled(committed.body.id)).status).toBe("completed");

    const library = await request(http)
      .get("/api/library")
      .set("Cookie", cookies)
      .expect(200);
    expect(library.body.items).toHaveLength(1);
    expect(library.body.items[0]).toMatchObject({
      status: "WATCHING",
      rating: 8,
      progress: { watchedEpisodes: 2 },
    });
  });

  it("refuses what can't be a user name, naming why", async () => {
    const refused = await request(http)
      .post("/api/import/anilist/analyze")
      .set("Cookie", cookies)
      .send({ input: "not a name!" })
      .expect(400);

    expect(refused.body.code).toBe("import.anilist_user_not_found");
  });
});
