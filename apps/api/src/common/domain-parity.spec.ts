import { XP_RULES } from "@loomkeep/shared";
import { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import {
  AdminCacheService,
  type CacheDomain,
} from "../admin/admin-cache.service";
import { BookItemService } from "../books/book-item.service";
import { BookLibraryService } from "../books/book-library.service";
import { MediaItemService } from "../catalog/media-item.service";
import { GameItemService } from "../games/game-item.service";
import { GameLibraryService } from "../games/game-library.service";
import { LibraryService } from "../library/library.service";
import { MusicItemService } from "../music/music-item.service";
import { MusicLibraryService } from "../music/music-library.service";
import type { PrismaService } from "../prisma/prisma.service";

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
 * Every XP source (`XP_RULES[*].sourceType`) whose rows go away with a
 * library entry, per domain: deleting the entry must revoke each of them.
 */
const ENTRY_XP_SOURCES: Record<CacheDomain, string[]> = {
  MEDIA: [
    "LibraryEntry",
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
    new LibraryService(
      prisma,
      unused,
      unused,
      unused,
      activity,
      xp,
      unused,
      unused,
      unused,
    ),
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
    ),
  MUSIC: (prisma, { xp, activity }) =>
    new MusicLibraryService(
      prisma,
      unused,
      unused,
      activity,
      xp,
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
          .filter(([, ids]) => (ids as string[]).length > 0)
          .map(([sourceType]) => sourceType),
      );
      expect([...revoked].sort()).toEqual(
        expect.arrayContaining([...ENTRY_XP_SOURCES[domain]].sort()),
      );
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
