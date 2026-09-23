import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { vi } from "vitest";
import { FeatureFlagsService } from "../src/feature-flags/feature-flags.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * One import, analyze → review → commit, through the real job framework.
 *
 * Unit tests cover each source's parsing and the job store separately; what
 * only an end-to-end run proves is the handover between them — the parse model
 * surviving on a background job between two HTTP requests, the plan keys the
 * client sends back selecting the right items, and the commit landing in the
 * library.
 *
 * The order here is load-bearing, and both constraints are product rules
 * rather than test scaffolding: a new analysis invalidates the previous one,
 * and the free plan allows a single import per domain. So the refusals come
 * first and the one real import last.
 *
 * MyAnimeList is the source used because its export is a single XML string —
 * no ZIP to build — and it resolves through AniList, which the suite stubs.
 */
const MAL_EXPORT = `<?xml version="1.0" encoding="UTF-8"?>
<myanimelist>
  <myinfo><user_export_type>1</user_export_type></myinfo>
  <anime>
    <series_animedb_id>4242</series_animedb_id>
    <series_title><![CDATA[Test Anime]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>3</series_episodes>
    <my_watched_episodes>2</my_watched_episodes>
    <my_start_date>2026-01-10</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>8</my_score>
    <my_storage></my_storage>
    <my_status>Watching</my_status>
    <my_comments><![CDATA[]]></my_comments>
  </anime>
</myanimelist>`;

describe("Import (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;

  const user = e2eUser("e2e-import");
  let cookies: string;

  /** Polls a job until it leaves `running`, the way the wizard does. */
  async function settled(jobId: string) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = await request(http)
        .get(`/api/import/myanimelist/${jobId}`)
        .set("Cookie", cookies)
        .expect(200);
      if (res.body.status !== "running") return res.body;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("Import job never settled");
  }

  /** Analyzes the export and returns the settled job, plan included. */
  async function analyze(input = MAL_EXPORT) {
    const started = await request(http)
      .post("/api/import/myanimelist/analyze")
      .set("Cookie", cookies)
      .send({ input })
      .expect(201);
    return settled(started.body.id);
  }

  function planKeysOf(job: {
    plan: { groups: { items: { key: string }[] }[] };
  }): string[] {
    return job.plan.groups.flatMap((g) => g.items.map((i) => i.key));
  }

  beforeAll(async () => {
    ({ app, http } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);
    cookies = authCookies(registered);

    // A fresh account enables no domain (schema default), and every media
    // route sits behind that gate.
    await request(http)
      .patch("/api/users/me")
      .set("Cookie", cookies)
      .send({ enabledDomains: ["MEDIA"] })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists the sources an instance can actually use", async () => {
    const res = await request(http)
      .get("/api/import/availability")
      .set("Cookie", cookies)
      .expect(200);

    // A source needing no env key of its own is simply absent from the map.
    expect(res.body).not.toHaveProperty("myanimelist");
  });

  it("refuses a malformed export as a client error, not a failed job", async () => {
    // A parse failure is the client's: no job may be left behind holding the
    // account's one free import slot.
    await request(http)
      .post("/api/import/myanimelist/analyze")
      .set("Cookie", cookies)
      .send({ input: "not xml at all" })
      .expect(400);

    const quota = await request(http)
      .get("/api/import/quota")
      .set("Cookie", cookies)
      .expect(200);
    expect(quota.body).toEqual({});
  });

  it("invalidates an earlier analysis once a new one starts", async () => {
    // Only the newest analysis stays committable: the older one's parse model
    // is released instead of being kept in memory for the retention hour.
    const first = await analyze();
    const keys = planKeysOf(first);
    await analyze();

    await request(http)
      .post(`/api/import/myanimelist/${first.id}/commit`)
      .set("Cookie", cookies)
      .send({ include: keys })
      .expect(400);
  });

  it("analyzes the export into a reviewable plan, writing nothing", async () => {
    const job = await analyze();

    expect(job.status).toBe("completed");
    expect(job.plan.counts).toMatchObject({ total: 1, unresolved: 0 });
    expect(planKeysOf(job)).toEqual(["anilist:4242"]);

    // Nothing is tracked until the commit.
    const library = await request(http)
      .get("/api/library")
      .set("Cookie", cookies)
      .expect(200);
    expect(library.body.items).toHaveLength(0);
  });

  it("hides a job from every account but its own", async () => {
    const job = await analyze();
    const other = e2eUser("e2e-import-other");
    const registered = await request(http)
      .post("/api/auth/register")
      .send(other)
      .expect(201);

    await request(http)
      .get(`/api/import/myanimelist/${job.id}`)
      .set("Cookie", authCookies(registered))
      .expect(403);
  });

  it("writes only what the plan selected, with its watches and rating", async () => {
    const analyzed = await analyze();

    const committed = await request(http)
      .post(`/api/import/myanimelist/${analyzed.id}/commit`)
      .set("Cookie", cookies)
      .send({ include: planKeysOf(analyzed) })
      .expect(201);
    const done = await settled(committed.body.id);

    expect(done.status).toBe("completed");
    const episodes = done.report.tiles.find(
      (t: { id?: string }) => t.id === "episodes",
    );
    expect(episodes.value).toBe(2);

    const library = await request(http)
      .get("/api/library")
      .set("Cookie", cookies)
      .expect(200);
    expect(library.body.items).toHaveLength(1);
    const entry = library.body.items[0];
    expect(entry.mediaItem.title).toBe("Test Anime");
    // 2 of the 3 episodes watched, and the third has not aired.
    expect(entry.progress.watchedEpisodes).toBe(2);
    expect(entry.rating).toBe(8);
  });

  it("records the run in the account's own import history", async () => {
    const res = await request(http)
      .get("/api/import/history?page=1")
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toMatchObject({
      sourceId: "myanimelist",
      status: "SUCCESS",
    });
  });

  it("marks the domain as spent in the quota", async () => {
    const res = await request(http)
      .get("/api/import/quota")
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body).toMatchObject({ MEDIA: true });
  });

  it("refuses a second import into a domain already imported on the free plan", async () => {
    const flags = app.get(FeatureFlagsService);
    const isEnabled = flags.isEnabled.bind(flags);
    const premiumFlag = vi
      .spyOn(flags, "isEnabled")
      .mockImplementation((name, fallback) =>
        name === "premium-features" ? true : isEnabled(name, fallback),
      );

    try {
      // The refusal lands at analyze, before anything is parsed: a user must
      // not review a plan they cannot commit.
      await request(http)
        .post("/api/import/myanimelist/analyze")
        .set("Cookie", cookies)
        .send({ input: MAL_EXPORT })
        .expect(403);
    } finally {
      premiumFlag.mockRestore();
    }
  });
});
