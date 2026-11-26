import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PausedReminderService } from "../src/notifications/paused-reminder.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { StatsService } from "../src/stats/stats.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * A series is "in progress" because of what was watched, not because of its
 * stored status: ticking episodes never writes WATCHING, so the paused
 * reminder and the stale-series list must derive it as the library does.
 */
describe("In-progress series (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = new Date();
  const fortyDaysAgo = new Date(now.getTime() - 40 * DAY_MS);
  let seeded = 0;

  /** A series of `total` aired episodes, the first `watched` seen 40 days ago. */
  async function seedSeries(
    total: number,
    watched: number,
    status = "PLANNED",
    announced = 0,
  ) {
    seeded++;
    const item = await prisma.mediaItem.create({
      data: {
        type: "SERIES",
        canonicalSource: "TMDB",
        title: `In progress ${seeded}`,
        status: "Ended",
        externalIds: {
          create: {
            source: "TMDB",
            externalId: `ip-${seeded}`,
            type: "SERIES",
          },
        },
      },
    });
    const season = await prisma.season.create({
      data: { mediaItemId: item.id, number: 1 },
    });
    await prisma.mediaEntry.create({
      data: {
        userId,
        mediaItemId: item.id,
        status: status as "PLANNED" | "DROPPED",
      },
    });

    for (let n = 1; n <= total + announced; n++) {
      const episode = await prisma.episode.create({
        data: {
          seasonId: season.id,
          number: n,
          // The last `announced` ones are still to air.
          airDate: n <= total ? new Date("2024-01-01") : new Date("2099-01-01"),
        },
      });

      if (n <= watched) {
        await prisma.episodeWatch.create({
          data: { userId, episodeId: episode.id, watchedAt: fortyDaysAgo },
        });
      }
    }

    return item.title;
  }

  beforeAll(async () => {
    let http: App;
    ({ app, http, prisma } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-in-progress"))
      .expect(201);
    userId = (
      await request(http)
        .get("/api/users/me")
        .set("Cookie", authCookies(registered))
        .expect(200)
    ).body.id;
  });

  afterAll(() => app.close());

  it("counts a series ticked episode by episode, and leaves out the finished and dropped ones", async () => {
    const started = await seedSeries(4, 2);
    const finished = await seedSeries(3, 3);
    const dropped = await seedSeries(4, 1, "DROPPED");
    // Every aired episode seen, the next one only announced: waiting, not
    // paused, though the cached count makes it look partly watched.
    const waiting = await seedSeries(3, 3, "PLANNED", 1);

    const paused = (
      await app.get(PausedReminderService).pausedWorks(userId, now)
    ).map((w) => w.title);
    expect(paused).toContain(started);
    expect(paused).not.toContain(finished);
    expect(paused).not.toContain(dropped);
    expect(paused).not.toContain(waiting);

    const stale = (
      await app.get(StatsService).fetchInProgressStaleness(userId)
    ).map((s) => s.mediaItem.title);
    expect(stale).toContain(started);
    expect(stale).not.toContain(finished);
    expect(stale).not.toContain(dropped);
    expect(stale).not.toContain(waiting);
  });
});
