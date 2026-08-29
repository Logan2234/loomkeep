import {
  CatalogSource,
  ErrorCode,
  MediaSource,
  MediaType,
} from "@loomkeep/shared";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { AnilistProvider } from "./../src/catalog/providers/anilist.provider";
import type { ProviderMediaDetails } from "./../src/catalog/providers/provider.types";
import { TmdbProvider } from "./../src/catalog/providers/tmdb.provider";
import { PrismaService } from "./../src/prisma/prisma.service";

const ANIME_SUMMARY = {
  source: CatalogSource.ANILIST,
  sourceId: "4242",
  type: MediaType.ANIME,
  title: "Test Anime",
  year: 2024,
  posterUrl: "https://example.com/poster.jpg",
  isAdult: false,
};

const FUTURE_AIR_DATE = new Date(
  Date.now() + 30 * 24 * 60 * 60 * 1000,
).toISOString();

const ANIME_DETAILS: ProviderMediaDetails = {
  summary: ANIME_SUMMARY,
  overview: "An anime used by the e2e suite.",
  backdropUrl: null,
  genres: ["Fantasy"],
  status: "FINISHED",
  releaseDate: "2024-01-05",
  runtimeMin: null,
  externalIds: [{ source: MediaSource.ANILIST, externalId: "4242" }],
  seasons: [
    {
      number: 1,
      title: null,
      episodes: [
        { number: 1, title: "Episode 1", airDate: null },
        { number: 2, title: "Episode 2", airDate: null },
        // A future air date so the release calendar has something to return.
        { number: 3, title: "Episode 3", airDate: FUTURE_AIR_DATE },
      ],
    },
  ],
};

// External catalogues are stubbed: e2e exercises our API + database, not TMDB/AniList.
// getDetails echoes the requested id so different sourceIds yield distinct media.
const EMPTY_EXTRAS = {
  watchProviders: { flatrate: [], rent: [], buy: [], link: null },
  cast: [],
  similar: [],
  ratings: [],
};
const anilistStub = {
  source: CatalogSource.ANILIST,
  search: jest.fn().mockResolvedValue([ANIME_SUMMARY]),
  getDetails: jest.fn().mockImplementation((sourceId: string) =>
    Promise.resolve({
      ...ANIME_DETAILS,
      summary: { ...ANIME_SUMMARY, sourceId },
      externalIds: [{ source: MediaSource.ANILIST, externalId: sourceId }],
    }),
  ),
  getExtras: jest.fn().mockResolvedValue(EMPTY_EXTRAS),
};
const tmdbStub = {
  source: CatalogSource.TMDB,
  search: jest.fn().mockResolvedValue([]),
  getDetails: jest.fn(),
  getExtras: jest.fn().mockResolvedValue(EMPTY_EXTRAS),
};

describe("Loomkeep API (e2e)", () => {
  let app: INestApplication<App>;
  let http: App;

  const user = {
    email: "e2e@loomkeep.test",
    password: "E2e-password-1!",
    displayName: "E2E",
    acceptedTerms: true,
    certifiedAge: true,
  };
  let accessToken: string;
  let refreshToken: string;
  let entryId: string;
  let firstEpisodeId: string;
  let firstSeasonId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TmdbProvider)
      .useValue(tmdbStub)
      .overrideProvider(AnilistProvider)
      .useValue(anilistStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    // Start from a clean e2e schema (cascades cover the child tables).
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany();
    await prisma.mediaItem.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a new account", async () => {
    const response = await request(http)
      .post("/api/auth/register")
      .send(user)
      .expect(201);

    expect(response.body.user).toMatchObject({
      email: user.email,
      displayName: "E2E",
    });
    expect(response.body.tokens.accessToken).toBeDefined();
  });

  it("rejects a duplicate email", () => {
    return request(http).post("/api/auth/register").send(user).expect(409);
  });

  it("rejects registration with a password missing a required character class", () => {
    return request(http)
      .post("/api/auth/register")
      .send({
        ...user,
        email: "e2e-weak-password@loomkeep.test",
        password: "lowercaseonly1!",
      })
      .expect(400);
  });

  it("rejects registration without accepting the terms of service", () => {
    return request(http)
      .post("/api/auth/register")
      .send({
        ...user,
        email: "e2e-no-terms@loomkeep.test",
        acceptedTerms: false,
      })
      .expect(400);
  });

  it("rejects registration without certifying the minimum age", () => {
    return request(http)
      .post("/api/auth/register")
      .send({
        ...user,
        email: "e2e-no-age@loomkeep.test",
        certifiedAge: false,
      })
      .expect(400);
  });

  it("logs in and returns tokens", async () => {
    const response = await request(http)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: user.password })
      .expect(200);

    accessToken = response.body.tokens.accessToken;
    refreshToken = response.body.tokens.refreshToken;
    expect(accessToken).toBeDefined();
  });

  it("rejects unauthenticated access to the library", () => {
    return request(http).get("/api/library").expect(401);
  });

  it("returns the profile of the authenticated user", async () => {
    const response = await request(http)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      email: user.email,
      // Empty until the onboarding wizard (or the settings "Domaines"
      // section) sets at least one — see User.enabledDomains in schema.prisma.
      enabledDomains: [],
      // Set at registration — see AuthService.register (LK-C03).
      acceptedTermsVersion: expect.any(String),
    });
  });

  it("records re-acceptance of the CGU", async () => {
    const response = await request(http)
      .post("/api/users/me/accept-terms")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    expect(response.body.acceptedTermsVersion).toEqual(expect.any(String));
  });

  it("updates enabled domains and rejects an empty list", async () => {
    const patched = await request(http)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ enabledDomains: ["MEDIA"] })
      .expect(200);
    expect(patched.body.enabledDomains).toEqual(["MEDIA"]);

    // At least one domain must remain; an empty list is rejected by the DTO.
    await request(http)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ enabledDomains: [] })
      .expect(400);

    // Restore the default so later tests see a normal account.
    await request(http)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ enabledDomains: ["MEDIA", "BOOKS", "GAMES"] })
      .expect(200);
  });

  it("searches the catalog (stubbed providers)", async () => {
    const response = await request(http)
      .get("/api/catalog/search?q=test&type=ANIME")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toEqual([ANIME_SUMMARY]);
  });

  it("tracks a media: first touch persists it with seasons and episodes", async () => {
    const response = await request(http)
      .put("/api/library")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        source: "ANILIST",
        sourceId: "4242",
        type: "ANIME",
        status: "WATCHING",
      })
      .expect(200);

    entryId = response.body.id;
    expect(response.body.mediaItem.title).toBe("Test Anime");
    expect(response.body.mediaItem.sourceId).toBe("4242");
    // Status is derived: nothing watched yet → PLANNED, regardless of the
    // WATCHING sent in the request.
    expect(response.body.status).toBe("PLANNED");
    expect(response.body.progress).toMatchObject({
      watchedEpisodes: 0,
      totalEpisodes: 3,
    });
  });

  it("lists the library with the new entry", async () => {
    const response = await request(http)
      .get("/api/library?type=ANIME")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(entryId);
  });

  it("exposes the persisted episodes of the entry", async () => {
    const response = await request(http)
      .get(`/api/library/entries/${entryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.seasons).toHaveLength(1);
    expect(response.body.seasons[0].episodes).toHaveLength(3);
    firstSeasonId = response.body.seasons[0].id;
    firstEpisodeId = response.body.seasons[0].episodes[0].id;
    expect(response.body.seasons[0].episodes[0].watchCount).toBe(0);
  });

  it("marks an episode as watched and updates progress", async () => {
    await request(http)
      .post(`/api/library/episodes/${firstEpisodeId}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const entry = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(entry.body.progress).toMatchObject({
      watchedEpisodes: 1,
      totalEpisodes: 3,
    });
    expect(entry.body.status).toBe("WATCHING"); // 1 of 3 → in progress
  });

  it("supports rewatches: same episode again bumps the count, not the progress", async () => {
    await request(http)
      .post(`/api/library/episodes/${firstEpisodeId}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ rating: 9 })
      .expect(201);

    const episodes = await request(http)
      .get(`/api/library/entries/${entryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(episodes.body.seasons[0].episodes[0].watchCount).toBe(2);

    const entry = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(entry.body.progress).toMatchObject({
      watchedEpisodes: 1,
      totalEpisodes: 3,
    });
  });

  it("marks a whole season without inflating already-watched episodes, skipping unaired ones", async () => {
    // Episode 1 is already watched (twice); watchSeason fills episode 2 but
    // skips episode 3, whose air date is still in the future.
    await request(http)
      .post(`/api/library/seasons/${firstSeasonId}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const episodes = await request(http)
      .get(`/api/library/entries/${entryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const eps = episodes.body.seasons[0].episodes;
    expect(eps.map((e: { watchCount: number }) => e.watchCount)).toEqual([
      2, 1, 0,
    ]);

    const entry = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // Episode 3 still unwatched (unaired) → WATCHING, not COMPLETED.
    expect(entry.body.status).toBe("WATCHING");
  });

  it("rejects marking an unaired episode as watched, directly or via watch-through", async () => {
    const episodes = await request(http)
      .get(`/api/library/entries/${entryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const futureEpisodeId = episodes.body.seasons[0].episodes[2].id;

    const rejected = await request(http)
      .post(`/api/library/episodes/${futureEpisodeId}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})
      .expect(400);

    // Envelope shape (AllExceptionsFilter): a migrated AppException carries
    // a translatable code, not just a raw English message.
    expect(rejected.body).toMatchObject({
      statusCode: 400,
      code: ErrorCode.LibraryEpisodeNotAired,
    });
    expect(rejected.body.requestId).toEqual(expect.any(String));

    await request(http)
      .post(`/api/library/episodes/${futureEpisodeId}/watch-through`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);
  });

  it("returns upcoming episodes of tracked series in the calendar", async () => {
    const response = await request(http)
      .get("/api/library/calendar")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Only episode 3 has a future air date.
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 3,
      episodeTitle: "Episode 3",
    });
    expect(response.body[0].mediaItem.title).toBe("Test Anime");
  });

  it("serves the unified media page with metadata + the user's state", async () => {
    await request(http).get("/api/media/anime/4242").expect(401);

    const response = await request(http)
      .get("/api/media/anime/4242")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.title).toBe("Test Anime");
    expect(response.body.airingFinished).toBe(true);
    expect(response.body.seasons[0].episodes[0].watchCount).toBeGreaterThan(0);
    expect(response.body.entry).not.toBeNull();
    expect(response.body.entry.status).toBe("WATCHING");
  });

  it("keeps a manual dropped override until the user resumes", async () => {
    await request(http)
      .patch(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DROPPED" })
      .expect(200);

    const dropped = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // Override wins over the derived status.
    expect(dropped.body.status).toBe("DROPPED");

    // Resume → back to the derived status.
    await request(http)
      .patch(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "WATCHING" })
      .expect(200);
    const resumed = await request(http)
      .get(`/api/library/entries/${entryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(resumed.body.status).toBe("WATCHING");
  });

  it("marks episodes through a chosen one, excluding specials", async () => {
    // A fresh media so earlier watches don't interfere.
    const created = await request(http)
      .put("/api/library")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ source: "ANILIST", sourceId: "5555", type: "ANIME" })
      .expect(200);
    const newEntryId = created.body.id;

    const before = await request(http)
      .get(`/api/library/entries/${newEntryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const eps = before.body.seasons[0].episodes;

    // Watch through episode 2 → episodes 1 and 2, not 3.
    await request(http)
      .post(`/api/library/episodes/${eps[1].id}/watch-through`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const after = await request(http)
      .get(`/api/library/entries/${newEntryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const counts = after.body.seasons[0].episodes.map(
      (e: { watchCount: number }) => e.watchCount,
    );
    expect(counts).toEqual([1, 1, 0]);

    const entry = await request(http)
      .get(`/api/library/entries/${newEntryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(entry.body.progress).toMatchObject({
      watchedEpisodes: 2,
      totalEpisodes: 3,
    });
    expect(entry.body.status).toBe("WATCHING");

    // Undo watching episode 2 → back to 1 watched.
    await request(http)
      .delete(`/api/library/episodes/${eps[1].id}/watches`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const undone = await request(http)
      .get(`/api/library/entries/${newEntryId}/episodes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      undone.body.seasons[0].episodes.map(
        (e: { watchCount: number }) => e.watchCount,
      ),
    ).toEqual([1, 0, 0]);

    // #4 "Resume": next up is now episode 2 (first unwatched, released).
    const resume = await request(http)
      .get(`/api/library/entries/${newEntryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(resume.body.progress.nextEpisode).toMatchObject({
      episodeId: eps[1].id,
      episodeNumber: 2,
    });

    // The media detail exposes each viewing's date.
    const detail = await request(http)
      .get(`/api/media/anime/5555`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const firstEp = detail.body.seasons[0].episodes[0];
    expect(firstEp.watches).toHaveLength(1);
    expect(firstEp.watches[0].watchedAt).toBeDefined();
  });

  it("notifications: scan and feed respond", async () => {
    const scan = await request(http)
      .post("/api/notifications/scan")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(Array.isArray(scan.body.notifications)).toBe(true);
    expect(typeof scan.body.unread).toBe("number");

    await request(http)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(http)
      .post("/api/notifications/read")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });

  it("media extras: returns where-to-watch, cast and similar", async () => {
    const res = await request(http)
      .get("/api/catalog/anilist/5555/extras?type=ANIME")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.watchProviders).toBeDefined();
    expect(Array.isArray(res.body.cast)).toBe(true);
    expect(Array.isArray(res.body.similar)).toBe(true);
  });

  it("exports all account data (profile, library, watches)", async () => {
    const res = await request(http)
      .get("/api/users/me/export")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.exportedAt).toBeDefined();
    expect(res.body.account.email).toBe(user.email);
    // Never leak the password hash in an export.
    expect(res.body.account.passwordHash).toBeUndefined();

    // The suite tracked media and watched episodes, so both are present.
    expect(res.body.library.length).toBeGreaterThan(0);
    expect(res.body.library[0].media.title).toBeDefined();
    expect(res.body.library[0].media.sourceId).toBeDefined();
    expect(res.body.episodeWatches.length).toBeGreaterThan(0);
    expect(res.body.episodeWatches[0]).toMatchObject({
      seasonNumber: expect.any(Number),
      episodeNumber: expect.any(Number),
    });
  });

  it("rotates refresh tokens: the old one is consumed", async () => {
    const response = await request(http)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    const newRefreshToken: string = response.body.tokens.refreshToken;
    expect(newRefreshToken).toBeDefined();

    // The consumed token must be rejected.
    await request(http)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(401);

    refreshToken = newRefreshToken;
  });

  it("logs out: the refresh token becomes unusable", async () => {
    await request(http)
      .post("/api/auth/logout")
      .send({ refreshToken })
      .expect(204);
    await request(http)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(401);
  });

  it("tracks device sessions and rotates them in place", async () => {
    const u = {
      email: "e2e-sessions@loomkeep.test",
      password: "Sessions-1!",
      displayName: "Sessions",
      acceptedTerms: true,
      certifiedAge: true,
    };
    const reg = await request(http)
      .post("/api/auth/register")
      .send(u)
      .set("user-agent", "DeviceA")
      .expect(201);
    const tokenA: string = reg.body.tokens.accessToken;
    const refreshA: string = reg.body.tokens.refreshToken;

    // Registration opened exactly one session, labelled with its User-Agent.
    let list = await request(http)
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    const original = list.body[0];
    expect(original.userAgent).toBe("DeviceA");

    // Rotation updates the same row in place: same id and createdAt, not a new session.
    const rot = await request(http)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshA })
      .expect(200);
    const tokenA2: string = rot.body.tokens.accessToken;
    list = await request(http)
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${tokenA2}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(original.id);
    expect(list.body[0].createdAt).toBe(original.createdAt);

    // A second login opens a distinct device.
    const login2 = await request(http)
      .post("/api/auth/login")
      .send({ identifier: u.email, password: u.password })
      .set("user-agent", "DeviceB")
      .expect(200);
    const tokenB: string = login2.body.tokens.accessToken;
    const refreshB: string = login2.body.tokens.refreshToken;
    const jtiB: string = JSON.parse(
      Buffer.from(refreshB.split(".")[1], "base64url").toString(),
    ).jti;

    list = await request(http)
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(list.body).toHaveLength(2);

    // Revoke every other device: only DeviceB (the current jti) survives.
    await request(http)
      .delete(`/api/auth/sessions?except=${jtiB}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(204);
    list = await request(http)
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].jti).toBe(jtiB);

    // Revoking a single session by id works too.
    await request(http)
      .delete(`/api/auth/sessions/${list.body[0].id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(204);
    list = await request(http)
      .get("/api/auth/sessions")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("deletes the account and wipes access to it", async () => {
    // Throwaway account so the shared suite user stays intact.
    const victim = {
      email: "e2e-delete@loomkeep.test",
      password: "Delete-me-1!",
      displayName: "Delete",
      acceptedTerms: true,
      certifiedAge: true,
    };
    const registered = await request(http)
      .post("/api/auth/register")
      .send(victim)
      .expect(201);
    const token: string = registered.body.tokens.accessToken;

    // Wrong password is rejected — deletion is guarded like a credential change.
    await request(http)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrong" })
      .expect(401);

    await request(http)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: victim.password })
      .expect(204);

    // The row is gone: the (still-valid) JWT now resolves to no user…
    await request(http)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
    // …and the credentials no longer authenticate.
    await request(http)
      .post("/api/auth/login")
      .send({ identifier: victim.email, password: victim.password })
      .expect(401);
  });
});
