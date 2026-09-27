import { CatalogSource, MediaSource, MediaType } from "@loomkeep/shared";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test, TestingModule } from "@nestjs/testing";
import { App } from "supertest/types";
import { vi } from "vitest";
import { AppModule } from "./../src/app.module";
import { AnilistProvider } from "./../src/catalog/providers/anilist.provider";
import type { ProviderMediaDetails } from "./../src/catalog/providers/provider.types";
import { TmdbProvider } from "./../src/catalog/providers/tmdb.provider";
import { registerRequestContext } from "./../src/common/request-context";
import { PrismaService } from "./../src/prisma/prisma.service";

/**
 * Shared bootstrap for the e2e specs.
 *
 * Every spec file boots the whole AppModule against the isolated `e2e` schema
 * and truncates it first, so they must run one at a time — see
 * `fileParallelism: false` in vitest.config.e2e.mts. Splitting the suite by
 * flow is what this exists for: the setup is identical everywhere and was the
 * only thing keeping it all in one file.
 */

export const ANIME_SUMMARY = {
  source: CatalogSource.ANILIST,
  sourceId: "4242",
  type: MediaType.ANIME,
  title: "Test Anime",
  year: 2024,
  posterUrl: "https://example.com/poster.jpg",
  isAdult: false,
};

/** An episode that has not aired: progress must never count it. */
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
        {
          number: 1,
          title: "Episode 1",
          airDate: null,
          runtimeMin: 24,
          overview: null,
          stillUrl: null,
        },
        {
          number: 2,
          title: "Episode 2",
          airDate: null,
          runtimeMin: 24,
          overview: null,
          stillUrl: null,
        },
        {
          number: 3,
          title: "Episode 3",
          airDate: FUTURE_AIR_DATE,
          runtimeMin: 24,
          overview: null,
          stillUrl: null,
        },
      ],
    },
  ],
};

const EMPTY_EXTRAS = {
  watchProviders: { flatrate: [], rent: [], buy: [], link: null },
  cast: [],
  similar: [],
  ratings: [],
};

/** Catalogue providers are stubbed: no e2e run may depend on a live API. */
function providerStubs() {
  return {
    anilist: {
      source: CatalogSource.ANILIST,
      search: vi.fn().mockResolvedValue([ANIME_SUMMARY]),
      getDetails: vi.fn().mockImplementation((sourceId: string) =>
        Promise.resolve({
          ...ANIME_DETAILS,
          summary: { ...ANIME_SUMMARY, sourceId },
          externalIds: [{ source: MediaSource.ANILIST, externalId: sourceId }],
        }),
      ),
      getExtras: vi.fn().mockResolvedValue(EMPTY_EXTRAS),
      // The MyAnimeList import resolves exclusively through AniList's `idMal`.
      getSummaryByMalId: vi.fn().mockResolvedValue(ANIME_SUMMARY),
    },
    tmdb: {
      source: CatalogSource.TMDB,
      search: vi.fn().mockResolvedValue([]),
      getDetails: vi.fn(),
      getExtras: vi.fn().mockResolvedValue(EMPTY_EXTRAS),
    },
  };
}

export interface E2eApp {
  app: INestApplication<App>;
  http: App;
  prisma: PrismaService;
  stubs: ReturnType<typeof providerStubs>;
}

export async function createE2eApp(): Promise<E2eApp> {
  const stubs = providerStubs();
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TmdbProvider)
    .useValue(stubs.tmdb)
    .overrideProvider(AnilistProvider)
    .useValue(stubs.anilist)
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  registerRequestContext(app);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  // Fastify only starts routing after this — supertest requests made before it
  // resolves would 404, unlike Express's synchronous listen().
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);
  // Start from a clean e2e schema (cascades cover the child tables).
  await prisma.user.deleteMany();
  await prisma.mediaItem.deleteMany();

  return { app, http: app.getHttpServer(), prisma, stubs };
}

/** The `Cookie` header value for the session a response just established. */
export function authCookies(response: {
  headers: { "set-cookie"?: string | string[] };
}): string {
  const cookies = response.headers["set-cookie"];
  if (!Array.isArray(cookies))
    throw new Error("Expected authentication cookies");
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

/** A registration payload, unique per spec file so they never collide. */
export function e2eUser(local: string) {
  return {
    email: `${local}@loomkeep.test`,
    password: "E2e-password-1!",
    displayName: local.toUpperCase(),
    acceptedTerms: true,
    certifiedAge: true,
  };
}
