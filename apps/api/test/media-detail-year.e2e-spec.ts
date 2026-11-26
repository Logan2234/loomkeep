import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { LibraryService } from "../src/library/library.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { authCookies, createE2eApp, e2eUser } from "./e2e-app";

/**
 * Release dates are stored at midnight UTC: read in a server time zone west
 * of UTC, a 1 January release showed the previous year next to the right
 * date (audit 2026-11-17, BUG-52).
 */
describe("Media detail year (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  const previousTz = process.env.TZ;

  beforeAll(async () => {
    let http: App;
    ({ app, http, prisma } = await createE2eApp());
    const registered = await request(http)
      .post("/api/auth/register")
      .send(e2eUser("e2e-detail-year"))
      .expect(201);
    userId = (
      await request(http)
        .get("/api/users/me")
        .set("Cookie", authCookies(registered))
        .expect(200)
    ).body.id;
  });

  afterAll(async () => {
    process.env.TZ = previousTz;
    await app.close();
  });

  it("gives the release year in UTC, whatever the server's time zone", async () => {
    await prisma.mediaItem.create({
      data: {
        type: "MOVIE",
        canonicalSource: "TMDB",
        title: "New Year",
        status: "Released",
        releaseDate: new Date("2024-01-01T00:00:00Z"),
        movieReleaseDates: [],
        externalIds: {
          create: { source: "TMDB", externalId: "ny-2024", type: "MOVIE" },
        },
      },
    });
    process.env.TZ = "America/New_York";

    const detail = await app
      .get(LibraryService)
      .getMediaDetail(userId, "MOVIE", "ny-2024");

    expect(detail.year).toBe(2024);
  });
});
