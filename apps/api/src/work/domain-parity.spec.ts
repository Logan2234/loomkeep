import { Domain } from "@loomkeep/shared/enums";
import type { Type } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import {
  AdminCacheService,
  type CacheDomain,
} from "../admin/admin-cache.service";
import { BookItemService } from "../books/book-item.service";
import { BookLibraryService } from "../books/book-library.service";
import { BooksController } from "../books/books.controller";
import { isUniqueViolation } from "../common/prisma-error.util";
import { GameItemService } from "../games/game-item.service";
import { GameLibraryService } from "../games/game-library.service";
import { GamesController } from "../games/games.controller";
import { XP_RULES } from "../gamification/xp-rules";
import { JOB_KEYS } from "../jobs/job-keys";
import { MediaCatalogController } from "../media/media-catalog.controller";
import { MediaItemService } from "../media/media-item.service";
import { MediaLibraryController } from "../media/media-library.controller";
import { MediaController } from "../media/media.controller";
import { MusicItemService } from "../music/music-item.service";
import { MusicLibraryService } from "../music/music-library.service";
import { MusicController } from "../music/music.controller";
import type { PrismaService } from "../prisma/prisma.service";
import { entryEventBus } from "../test-utils/entry-event-bus";
import { mediaServices } from "../test-utils/media-services";
import { allDomainsConfig, stubSagas } from "../test-utils/stubs";
import { DOMAIN_GATE, DomainGateGuard } from "../users/domain-gate.guard";

/**
 * Parity across the four library domains. Each has its own services and
 * Prisma models, tested in isolation — which is how a fix kept landing in
 * one domain out of four (a first-track race handled for media only, XP left
 * behind by a deleted entry, an orphan purge that could delete a fresh
 * entry). Every case here runs the same scenario against all four.
 */

const USER = "user-1";
const ENTRY_ID = "entry-1";

/**
 * A PrismaService double: any `model.method` is a vi.fn created on first
 * access, with defaults that let a whole service flow run — lists hold one
 * row, lookups return an owned entry (that is also an unreferenced cached
 * item), writes succeed. `overrides` replaces single methods.
 */
function prismaDouble(overrides: Record<string, Record<string, Mock>> = {}) {
  const models = new Map<string, Record<string, Mock>>();
  const row = () => ({
    id: ENTRY_ID,
    userId: USER,
    mediaItemId: "item-1",
    gameItemId: "item-1",
    bookItemId: "item-1",
    musicItemId: "item-1",
    createdAt: new Date(),
    _count: { entries: 0 },
  });
  const defaults: Record<string, () => unknown> = {
    findMany: () => [
      { id: "child-1", createdAt: new Date(), episodes: [{ id: "ep-1" }] },
    ],
    findUnique: row,
    findFirst: row,
    deleteMany: () => ({ count: 1 }),
  };

  const prisma: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === "$transaction") {
          return vi.fn(async (arg: unknown) =>
            typeof arg === "function" ? arg(prisma) : Promise.all(arg as []),
          );
        }

        if (!models.has(key)) {
          models.set(
            key,
            new Proxy(
              { ...overrides[key] },
              {
                get(methods: Record<string, Mock>, method: string) {
                  methods[method] ??= vi.fn(async () =>
                    (defaults[method] ?? (() => ({ id: "row-1" })))(),
                  );
                  return methods[method];
                },
              },
            ),
          );
        }

        return models.get(key);
      },
    },
  );
  return prisma as unknown as PrismaService &
    Record<string, Record<string, Mock>>;
}

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const providerDetails = (source: string) => ({
  summary: { source, sourceId: "42", title: "Work", isAdult: false },
  externalIds: [{ source, externalId: "42" }],
  genres: [],
  seasons: [],
  screenshots: [],
  platforms: [],
  ratings: [],
  tracks: [],
  tags: [],
});

const provider = (source: string) => ({
  getDetails: vi.fn().mockResolvedValue(providerDetails(source)),
});

const jobRuns = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as never;

/** The Prisma models and the call that persists a work never seen before. */
const FIRST_TRACK: Record<
  CacheDomain,
  {
    externalIdModel: string;
    itemModel: string;
    itemKey: string;
    persist: (prisma: PrismaService) => Promise<unknown>;
  }
> = {
  MEDIA: {
    externalIdModel: "mediaExternalId",
    itemModel: "mediaItem",
    itemKey: "mediaItem",
    persist: (prisma) =>
      new MediaItemService(
        prisma,
        provider("TMDB") as never,
        provider("ANILIST") as never,
        jobRuns,
        {} as never,
        allDomainsConfig(),
      ).upsertFromSource("TMDB", "42", "MOVIE"),
  },
  GAMES: {
    externalIdModel: "gameExternalId",
    itemModel: "gameItem",
    itemKey: "gameItem",
    persist: (prisma) =>
      new GameItemService(
        prisma,
        provider("IGDB") as never,
        jobRuns,
        {} as never,
        allDomainsConfig(),
      ).persistDetails("IGDB", providerDetails("IGDB") as never),
  },
  BOOKS: {
    externalIdModel: "bookExternalId",
    itemModel: "bookItem",
    itemKey: "bookItem",
    persist: (prisma) =>
      new BookItemService(
        prisma,
        provider("OPEN_LIBRARY") as never,
        jobRuns,
        allDomainsConfig(),
      ).persistDetails(
        "OPEN_LIBRARY",
        providerDetails("OPEN_LIBRARY") as never,
      ),
  },
  MUSIC: {
    externalIdModel: "musicExternalId",
    itemModel: "musicItem",
    itemKey: "musicItem",
    persist: (prisma) =>
      new MusicItemService(
        prisma,
        provider("MUSICBRAINZ") as never,
      ).persistDetails("MUSICBRAINZ", providerDetails("MUSICBRAINZ") as never),
  },
};

describe.each(Object.keys(FIRST_TRACK) as CacheDomain[])(
  "%s first track of an uncached work",
  (domain) => {
    it("adopts the row a concurrent first track created instead of failing", async () => {
      const { externalIdModel, itemModel, itemKey, persist } =
        FIRST_TRACK[domain];
      const winner = { id: "winner" };
      const prisma = prismaDouble({
        [externalIdModel]: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ [itemKey]: winner }),
        },
        [itemModel]: { create: vi.fn().mockRejectedValue(uniqueViolation()) },
      });

      await expect(persist(prisma)).resolves.toBe(winner);
    });
  },
);

/**
 * A tracked work whose cache is stale, and a provider that fails to answer:
 * the call each domain makes when a user tracks or rates it again.
 */
const STALE_TRACK: Record<
  CacheDomain,
  {
    externalIdModel: string;
    itemKey: string;
    track: (prisma: PrismaService, outage: Error) => Promise<unknown>;
  }
> = {
  MEDIA: {
    externalIdModel: "mediaExternalId",
    itemKey: "mediaItem",
    track: (prisma, outage) =>
      new MediaItemService(
        prisma,
        { getDetails: vi.fn().mockRejectedValue(outage) } as never,
        provider("ANILIST") as never,
        jobRuns,
        {} as never,
        allDomainsConfig(),
      ).upsertFromSource("TMDB", "42", "MOVIE"),
  },
  GAMES: {
    externalIdModel: "gameExternalId",
    itemKey: "gameItem",
    track: (prisma, outage) =>
      new GameItemService(
        prisma,
        { getDetails: vi.fn().mockRejectedValue(outage) } as never,
        jobRuns,
        {} as never,
        allDomainsConfig(),
      ).upsertFromSource("IGDB", "42"),
  },
  BOOKS: {
    externalIdModel: "bookExternalId",
    itemKey: "bookItem",
    track: (prisma, outage) =>
      new BookItemService(
        prisma,
        { getStoredDetails: vi.fn().mockRejectedValue(outage) } as never,
        jobRuns,
        allDomainsConfig(),
      ).upsertFromSource("OPEN_LIBRARY", "42"),
  },
  MUSIC: {
    externalIdModel: "musicExternalId",
    itemKey: "musicItem",
    track: (prisma, outage) =>
      new MusicItemService(prisma, {
        getDetails: vi.fn().mockRejectedValue(outage),
      } as never).upsertFromSource("MUSICBRAINZ", "42"),
  },
};

// A provider outage used to fail tracking a work the cache already held,
// as soon as its copy was over a day old (audit 2026-11-14, BUG-03).
describe.each(Object.keys(STALE_TRACK) as CacheDomain[])(
  "%s track of a stale cached work during a provider outage",
  (domain) => {
    it("serves the cached copy instead of failing", async () => {
      const { externalIdModel, itemKey, track } = STALE_TRACK[domain];
      const cached = {
        id: "cached",
        lastSyncedAt: new Date("2020-01-01T00:00:00Z"),
        movieReleaseDates: [],
      };
      const prisma = prismaDouble({
        [externalIdModel]: {
          findUnique: vi.fn().mockResolvedValue({
            [`${itemKey}Id`]: "cached",
            [itemKey]: cached,
          }),
        },
      });

      await expect(track(prisma, new Error("provider down"))).resolves.toBe(
        cached,
      );
    });

    it("still fails for a work never cached", async () => {
      const { externalIdModel, track } = STALE_TRACK[domain];
      const prisma = prismaDouble({
        [externalIdModel]: { findUnique: vi.fn().mockResolvedValue(null) },
      });

      await expect(track(prisma, new Error("provider down"))).rejects.toThrow(
        "provider down",
      );
    });
  },
);

/**
 * Every XP source (`XP_RULES[*].sourceType`) whose rows go away with a
 * library entry, per domain: deleting the entry must revoke each of them.
 */
const ENTRY_XP_SOURCES: Record<CacheDomain, string[]> = {
  MEDIA: [
    "MediaEntry",
    "Entry",
    "EpisodeWatch",
    "MovieReplay",
    "Season",
    "Review",
  ],
  GAMES: ["Entry", "GamePlaythrough", "Review"],
  BOOKS: ["Entry", "BookReading", "Review"],
  MUSIC: ["MusicEntry", "Entry", "Review"],
};

/** XP sources an entry removal leaves alone, each for its own reason. */
const NON_ENTRY_XP_SOURCES = [
  // Recomputed for the session's day by SessionXpService (checked below).
  "SESSION_DAY",
  // Once per domain, earned for good.
  "DOMAIN",
  // Social actions and milestones that don't belong to one entry.
  "Comment",
  "CommentReaction",
  "ReviewVote",
  "List",
  "Saga",
  "ReadingGoal",
  "UserAchievement",
  "AdminAdjustment",
  "User",
];

it("classifies every XP source as anchored to an entry or not", () => {
  const classified = new Set([
    ...Object.values(ENTRY_XP_SOURCES).flat(),
    ...NON_ENTRY_XP_SOURCES,
  ]);
  const unclassified = Object.values(XP_RULES)
    .map((rule) => rule.sourceType)
    .filter((sourceType) => !classified.has(sourceType));

  // A new XP reason lands here first: add its source to the domains whose
  // deleteEntry must revoke it, or to NON_ENTRY_XP_SOURCES.
  expect(unclassified).toEqual([]);
});

/** Collaborators a deleteEntry never reaches. */
const unused = {} as never;

const DELETE_ENTRY: Record<
  CacheDomain,
  (
    prisma: PrismaService,
    deps: { xp: never; activity: never; sessionXp: never },
  ) => { deleteEntry(userId: string, entryId: string): Promise<void> }
> = {
  MEDIA: (prisma, { xp, activity }) =>
    mediaServices(
      prisma,
      unused,
      unused,
      unused,
      activity,
      xp,
      unused,
      unused,
      unused,
    ).library,
  GAMES: (prisma, { xp, activity, sessionXp }) =>
    new GameLibraryService(
      prisma,
      unused,
      unused,
      unused,
      activity,
      xp,
      unused,
      unused,
      unused,
      sessionXp,
      stubSagas(),
    ),
  BOOKS: (prisma, { xp, activity, sessionXp }) =>
    new BookLibraryService(
      prisma,
      unused,
      unused,
      unused,
      activity,
      xp,
      unused,
      unused,
      unused,
      sessionXp,
      stubSagas(),
    ),
  MUSIC: (prisma, { xp, activity }) =>
    new MusicLibraryService(
      prisma,
      unused,
      unused,
      entryEventBus({ xp, activity }),
      unused,
      unused,
    ),
};

describe.each(Object.keys(DELETE_ENTRY) as CacheDomain[])(
  "%s entry deletion",
  (domain) => {
    function deleteEntry() {
      const xp = { revokeBySource: vi.fn() };
      const activity = { deleteLinked: vi.fn() };
      const sessionXp = { refreshAfterDelete: vi.fn() };
      const service = DELETE_ENTRY[domain](prismaDouble(), {
        xp: xp as never,
        activity: activity as never,
        sessionXp: sessionXp as never,
      });
      return { run: () => service.deleteEntry(USER, ENTRY_ID), xp, sessionXp };
    }

    it("revokes every XP source anchored to the entry", async () => {
      const { run, xp } = deleteEntry();

      await run();

      const revoked = new Set(
        xp.revokeBySource.mock.calls
          .filter(([, , ids]) => (ids as string[]).length > 0)
          .map(([, sourceType]) => sourceType),
      );
      expect([...revoked].sort()).toEqual(
        expect.arrayContaining([...ENTRY_XP_SOURCES[domain]].sort()),
      );
    });

    // Some sources are shared catalogue rows (a season), so a revocation
    // that isn't scoped to the remover takes the XP of everyone who earned
    // it from that row (audit 2026-11-14, BUG-01).
    it("revokes only the remover's own XP", async () => {
      const { run, xp } = deleteEntry();

      await run();

      expect(xp.revokeBySource).toHaveBeenCalled();

      for (const [userId] of xp.revokeBySource.mock.calls) {
        expect(userId).toBe(USER);
      }
    });

    if (domain === "GAMES" || domain === "BOOKS") {
      it("recomputes the day's session XP of every session it removes", async () => {
        const { run, sessionXp } = deleteEntry();

        await run();

        expect(sessionXp.refreshAfterDelete).toHaveBeenCalledWith(
          USER,
          expect.any(Date),
        );
      });
    }
  },
);

const CACHE_MODEL: Record<CacheDomain, string> = {
  MEDIA: "mediaItem",
  GAMES: "gameItem",
  BOOKS: "bookItem",
  MUSIC: "musicItem",
};

describe.each(Object.keys(CACHE_MODEL) as CacheDomain[])(
  "%s orphan purge",
  (domain) => {
    function cacheService(deleted: number) {
      const none = { findMany: vi.fn().mockResolvedValue([]) };
      const prisma = prismaDouble({
        [CACHE_MODEL[domain]]: {
          findMany: vi.fn().mockResolvedValue([{ id: "orphan-1" }]),
          deleteMany: vi.fn().mockResolvedValue({ count: deleted }),
        },
        season: none,
        review: none,
        comment: none,
        activityEvent: none,
      });
      const service = new AdminCacheService(
        prisma,
        unused,
        unused,
        unused,
        unused,
      );
      return { service, prisma };
    }

    it("only deletes orphans that are still untracked at delete time", async () => {
      const { service, prisma } = cacheService(1);

      await service.removeOrphans(domain);

      expect(prisma[CACHE_MODEL[domain]].deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["orphan-1"] }, entries: { none: {} } },
      });
    });

    it("refuses a single purge when the item got tracked in the meantime", async () => {
      const { service } = cacheService(0);

      await expect(service.remove(domain, "orphan-1")).rejects.toMatchObject({
        status: 409,
      });
    });
  },
);

/**
 * A detail page's first paint, from the stored row alone (media already reads
 * its page from the cache). Built without its constructor: the call only
 * reaches prisma, the age gate and the user's rating.
 */
const STORED_DETAIL: Record<
  Exclude<CacheDomain, "MEDIA">,
  {
    externalIdModel: string;
    entryModel: string;
    itemKey: string;
    adultGated: boolean;
    read: (
      service: object,
    ) => (userId: string, source: never, sourceId: string) => Promise<unknown>;
    proto: object;
  }
> = {
  GAMES: {
    externalIdModel: "gameExternalId",
    entryModel: "gameEntry",
    itemKey: "gameItem",
    adultGated: true,
    proto: GameLibraryService.prototype,
    read: (s) => (s as GameLibraryService).getStoredGameDetail.bind(s),
  },
  BOOKS: {
    externalIdModel: "bookExternalId",
    entryModel: "bookEntry",
    itemKey: "bookItem",
    adultGated: true,
    proto: BookLibraryService.prototype,
    read: (s) => (s as BookLibraryService).getStoredBookDetail.bind(s),
  },
  MUSIC: {
    externalIdModel: "musicExternalId",
    entryModel: "musicEntry",
    itemKey: "musicItem",
    adultGated: false,
    proto: MusicLibraryService.prototype,
    read: (s) => (s as MusicLibraryService).getStoredMusicDetail.bind(s),
  },
};

describe.each(Object.keys(STORED_DETAIL) as Exclude<CacheDomain, "MEDIA">[])(
  "%s stored detail",
  (domain) => {
    const { externalIdModel, entryModel, itemKey, adultGated, proto, read } =
      STORED_DETAIL[domain];
    const item = (isAdult = false) => ({
      id: "item-1",
      title: "Stored title",
      authors: [],
      artists: [],
      genres: ["Drama"],
      platforms: [],
      coverUrl: null,
      overview: null,
      releaseDate: new Date("2020-05-01"),
      releaseDatePrecision: "DAY",
      timeToBeatHastilyMin: null,
      timeToBeatNormallyMin: null,
      timeToBeatCompletelyMin: null,
      isAdult,
    });

    function storedDetail(ref: unknown, allowsAdult = true) {
      const prisma = prismaDouble({
        [externalIdModel]: { findUnique: vi.fn().mockResolvedValue(ref) },
        // The user hasn't tracked it: someone else's entry put it in the cache.
        [entryModel]: { findUnique: vi.fn().mockResolvedValue(null) },
      });
      const service = Object.assign(Object.create(proto), {
        prisma,
        ageGate: { allowsAdultContent: vi.fn().mockResolvedValue(allowsAdult) },
        reviews: { getRating: vi.fn().mockResolvedValue(7) },
      });
      return read(service)(USER, "SOURCE" as never, "42");
    }

    it("is null for a work nobody tracks yet", async () => {
      await expect(storedDetail(null)).resolves.toBeNull();
    });

    it("answers from the stored row", async () => {
      await expect(storedDetail({ [itemKey]: item() })).resolves.toMatchObject({
        title: "Stored title",
        year: 2020,
        genres: ["Drama"],
        commentTargetId: "item-1",
        entry: null,
      });
    });

    if (adultGated) {
      it("shows nothing of an 18+ title the account can't see", async () => {
        await expect(
          storedDetail({ [itemKey]: item(true) }, false),
        ).resolves.toBeNull();
      });
    }
  },
);

/**
 * Each cached domain re-syncs stale works on a schedule. Music has no job by
 * design (an album only refreshes when someone tracks it again, see
 * CLAUDE.md): that is the one declared exception, not an oversight to copy.
 */
const REFRESH_CRON: Record<
  CacheDomain,
  { proto: object; jobKey: string } | null
> = {
  MEDIA: {
    proto: MediaItemService.prototype,
    jobKey: JOB_KEYS.MEDIA_REFRESH_STALE,
  },
  GAMES: {
    proto: GameItemService.prototype,
    jobKey: JOB_KEYS.GAMES_REFRESH_STALE,
  },
  BOOKS: {
    proto: BookItemService.prototype,
    jobKey: JOB_KEYS.BOOKS_REFRESH_STALE,
  },
  MUSIC: null,
};

// @nestjs/schedule's key for @Cron options (not exported from its index).
const CRON_METADATA = "SCHEDULE_CRON_OPTIONS";

describe.each(
  (Object.keys(REFRESH_CRON) as CacheDomain[]).filter((d) => REFRESH_CRON[d]),
)("%s stale refresh", (domain) => {
  it("is scheduled under its own job key", () => {
    const { proto, jobKey } = REFRESH_CRON[domain]!;
    const refreshStale = (proto as { refreshStale?: () => unknown })
      .refreshStale;

    expect(refreshStale).toBeTypeOf("function");
    expect(Reflect.getMetadata(CRON_METADATA, refreshStale!)).toMatchObject({
      name: jobKey,
    });
  });
});

it("gives every *_REFRESH_STALE job key to a domain's refresh", () => {
  const declared = Object.values(REFRESH_CRON)
    .filter((cron) => cron !== null)
    .map((cron) => cron.jobKey);
  const refreshJobs = Object.entries(JOB_KEYS)
    .filter(([name]) => name.endsWith("_REFRESH_STALE"))
    .map(([, key]) => key);

  expect([...refreshJobs].sort()).toEqual([...declared].sort());
});

/** A permissive collaborator: every method resolves to nothing. */
const anything = () =>
  new Proxy(
    {},
    {
      get: (target: Record<string, Mock>, key: string) =>
        (target[key] ??= vi.fn().mockResolvedValue(undefined)),
    },
  ) as never;

/**
 * Two "add" requests for the same work at once: the loser's insert hits the
 * entry's unique key. Each domain's upsertEntry runs it once more and finds
 * the winner's row (the P2002 must never surface as a 500).
 */
const UPSERT_ENTRY: Record<
  CacheDomain,
  {
    entryModel: string;
    add: (prisma: PrismaService) => Promise<unknown>;
  }
> = {
  MEDIA: {
    entryModel: "mediaEntry",
    add: (prisma) =>
      mediaServices(
        prisma,
        {
          upsertFromSource: vi
            .fn()
            .mockResolvedValue({ id: "item-1", type: "MOVIE" }),
        } as never,
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
      ).library.upsertEntry(USER, {
        source: "TMDB",
        sourceId: "42",
        type: "MOVIE",
      } as never),
  },
  GAMES: {
    entryModel: "gameEntry",
    add: (prisma) =>
      new GameLibraryService(
        prisma,
        {
          upsertFromSource: vi.fn().mockResolvedValue({ id: "item-1" }),
        } as never,
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        stubSagas(),
      ).upsertEntry(USER, { source: "IGDB", sourceId: "42" } as never),
  },
  BOOKS: {
    entryModel: "bookEntry",
    add: (prisma) =>
      new BookLibraryService(
        prisma,
        {
          upsertFromSource: vi.fn().mockResolvedValue({ id: "item-1" }),
        } as never,
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        anything(),
        stubSagas(),
      ).upsertEntry(USER, { source: "OPEN_LIBRARY", sourceId: "42" } as never),
  },
  MUSIC: {
    entryModel: "musicEntry",
    add: (prisma) =>
      new MusicLibraryService(
        prisma,
        {
          upsertFromSource: vi.fn().mockResolvedValue({ id: "item-1" }),
        } as never,
        anything(),
        entryEventBus(),
        anything(),
        anything(),
      ).upsertEntry(USER, { source: "MUSICBRAINZ", sourceId: "42" } as never),
  },
};

describe.each(Object.keys(UPSERT_ENTRY) as CacheDomain[])(
  "%s concurrent add of the same work",
  (domain) => {
    it("retries the insert that lost the race instead of failing on it", async () => {
      const { entryModel, add } = UPSERT_ENTRY[domain];
      const upsert = vi
        .fn()
        .mockRejectedValueOnce(uniqueViolation())
        .mockResolvedValue({ id: ENTRY_ID, userId: USER });
      const prisma = prismaDouble({
        [entryModel]: { findUnique: vi.fn().mockResolvedValue(null), upsert },
      });

      // What follows the write (the DTO, XP, activity) isn't this case's
      // business and may trip over the doubles: only the race matters.
      const outcome = await add(prisma).catch((err: unknown) => err);

      expect(upsert).toHaveBeenCalledTimes(2);
      expect(isUniqueViolation(outcome)).toBe(false);
    });
  },
);

// Games and books used to check the gate on search and lists only: writes,
// sessions and the detail page stayed open on a domain the user turned off
// or the instance withdrew (audit 2026-11-17, PRM-02). Media's controllers
// are gated since the cross-domain routes (calendar, counts) left them.
const GATED_CONTROLLER: Record<CacheDomain, [Type[], Domain]> = {
  MEDIA: [
    [MediaLibraryController, MediaCatalogController, MediaController],
    Domain.MEDIA,
  ],
  GAMES: [[GamesController], Domain.GAMES],
  BOOKS: [[BooksController], Domain.BOOKS],
  MUSIC: [[MusicController], Domain.MUSIC],
};

describe.each(Object.keys(GATED_CONTROLLER) as CacheDomain[])(
  "%s controllers",
  (domain) => {
    it("gate every route on the user's domain", () => {
      const [controllers, gatedDomain] = GATED_CONTROLLER[domain];

      for (const controller of controllers) {
        expect(Reflect.getMetadata(DOMAIN_GATE, controller)).toBe(gatedDomain);
        expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toContain(
          DomainGateGuard,
        );
      }
    });
  },
);
