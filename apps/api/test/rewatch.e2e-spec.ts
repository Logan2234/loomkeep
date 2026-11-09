import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { LibraryService } from "./../src/library/library.service";
import type { PrismaService } from "./../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * Rewatching a finished title: the series goes back to in progress with its
 * progress counted from the rewatch, ends by itself once every episode is
 * seen again; the movie goes back to "to watch" until logged as rewatched.
 */
describe("Rewatch (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string;

  const get = (url: string) => request(http).get(url).set("Cookie", cookie);
  const post = (url: string) => request(http).post(url).set("Cookie", cookie);
  const patch = (url: string) => request(http).patch(url).set("Cookie", cookie);

  const longAgo = new Date("2025-03-14T20:00:00Z");

  let seeded = 0;

  async function seed(type: "SERIES" | "MOVIE", episodes = 0) {
    seeded++;
    const item = await prisma.mediaItem.create({
      data: {
        type,
        canonicalSource: "TMDB",
        title: `Rewatch ${type}`,
        status: type === "MOVIE" ? "Released" : "Ended",
        externalIds: {
          create: { source: "TMDB", externalId: `rw-${seeded}`, type },
        },
      },
    });
    const episodeIds: string[] = [];

    if (episodes > 0) {
      const season = await prisma.season.create({
        data: { mediaItemId: item.id, number: 1 },
      });

      for (let n = 1; n <= episodes; n++) {
        const episode = await prisma.episode.create({
          data: { seasonId: season.id, number: n },
        });
        episodeIds.push(episode.id);
        await prisma.episodeWatch.create({
          data: { userId, episodeId: episode.id, watchedAt: longAgo },
        });
      }
    }

    const entry = await prisma.libraryEntry.create({
      data: { userId, mediaItemId: item.id, status: "COMPLETED" },
    });
    return { entryId: entry.id, episodeIds };
  }

  beforeAll(async () => {
    ({ app, http, prisma } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-rewatch"))
      .expect(201);
    cookie = authCookies(registered);
    userId = (await get("/api/users/me").expect(200)).body.id;
  });

  afterAll(() => app.close());

  it("rewatches a finished series until every episode is seen again", async () => {
    const { entryId, episodeIds } = await seed("SERIES", 3);
    const [e1, e2, e3] = episodeIds;

    expect((await get(`/api/library/entries/${entryId}`)).body.status).toBe(
      "COMPLETED",
    );

    await post(`/api/library/episodes/${e2}/watches`).send({}).expect(201);
    const started = await patch(`/api/library/entries/${entryId}`)
      .send({ rewatching: true })
      .expect(200);

    expect(started.body).toMatchObject({
      status: "WATCHING",
      rewatching: true,
      progress: { watchedEpisodes: 1, totalEpisodes: 3 },
    });
    expect(started.body.progress.nextEpisode.episodeId).toBe(e3);

    const watching = await app
      .get(LibraryService)
      .listEntries(userId, { statuses: ["WATCHING"] });
    expect(watching.items.map((e) => e.id)).toContain(entryId);

    // The skipped first episode comes back once the end is reached.
    await post("/api/library/episodes/watches/batch")
      .send({ action: "rewatch", episodeIds: [e3] })
      .expect(200);
    const atEnd = await get(`/api/library/entries/${entryId}`).expect(200);
    expect(atEnd.body.progress.nextEpisode.episodeId).toBe(e1);

    await post(`/api/library/episodes/${e1}/watches`).send({}).expect(201);
    const finished = await get(`/api/library/entries/${entryId}`).expect(200);
    expect(finished.body).toMatchObject({
      status: "COMPLETED",
      rewatching: false,
      progress: { watchedEpisodes: 3, totalEpisodes: 3 },
    });
  });

  it("unticks the episodes during a rewatch, and marks a season seen again", async () => {
    const { entryId, episodeIds } = await seed("SERIES", 3);
    const [e1] = episodeIds;
    await post(`/api/library/episodes/${e1}/watches`).send({}).expect(201);
    await patch(`/api/library/entries/${entryId}`)
      .send({ rewatching: true })
      .expect(200);

    const entry = await prisma.libraryEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { mediaItem: { include: { externalIds: true } } },
    });
    const sourceId = entry.mediaItem.externalIds[0].externalId;
    const episodes = async () =>
      (
        await app.get(LibraryService).getMediaDetail(userId, "SERIES", sourceId)
      ).seasons[0].episodes.map((e) => [e.seen, e.watchCount]);

    expect(await episodes()).toEqual([
      [true, 2],
      [false, 1],
      [false, 1],
    ]);

    const season = await prisma.season.findFirstOrThrow({
      where: { mediaItemId: entry.mediaItemId },
    });
    await post(`/api/library/seasons/${season.id}/watches`).send({});
    const finished = await get(`/api/library/entries/${entryId}`).expect(200);
    expect(finished.body).toMatchObject({
      status: "COMPLETED",
      rewatching: false,
    });
    expect(await episodes()).toEqual([
      [true, 2],
      [true, 2],
      [true, 2],
    ]);
  });

  it("stops a series' rewatch on demand", async () => {
    const { entryId, episodeIds } = await seed("SERIES", 2);
    await post(`/api/library/episodes/${episodeIds[0]}/watches`)
      .send({})
      .expect(201);
    await patch(`/api/library/entries/${entryId}`)
      .send({ rewatching: true })
      .expect(200);

    const stopped = await patch(`/api/library/entries/${entryId}`)
      .send({ rewatching: false })
      .expect(200);
    expect(stopped.body).toMatchObject({
      status: "COMPLETED",
      rewatching: false,
    });
  });

  it("puts a seen movie back to watch until it is logged as rewatched", async () => {
    const { entryId } = await seed("MOVIE");

    const queued = await patch(`/api/library/entries/${entryId}`)
      .send({ rewatching: true })
      .expect(200);
    expect(queued.body).toMatchObject({ status: "PLANNED", rewatching: true });

    const seen = await post(`/api/library/entries/${entryId}/replays`)
      .send({})
      .expect(201);
    expect(seen.body).toMatchObject({ status: "COMPLETED", rewatching: false });
    expect(seen.body.replays).toHaveLength(1);
  });
});
