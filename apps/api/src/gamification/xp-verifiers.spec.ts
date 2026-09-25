import { XpReason } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { XP_VERIFIERS, type XpEntryRef } from "./xp-verifiers";

function entry(over: Partial<XpEntryRef> = {}): XpEntryRef {
  return { id: "e1", sourceId: "s1", userId: "u1", ...over };
}

describe("XP_VERIFIERS — batching", () => {
  it("checks a whole batch in one query, not one per entry", async () => {
    // The regression this guards: the sweep walks the entire ledger nightly,
    // so a round-trip per row was three orders of magnitude of wasted work.
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
    const prisma = { episodeWatch: { findMany } } as unknown as PrismaService;
    const batch = ["s1", "s2", "s3"].map((sourceId, i) =>
      entry({ id: `e${i}`, sourceId }),
    );

    const valid = await XP_VERIFIERS[XpReason.EPISODE_WATCHED]!(prisma, batch);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["s1", "s2", "s3"] },
    });
    expect([...valid].sort()).toEqual(["e0", "e1", "e2"]);
  });

  it("keeps only the entries whose source came back", async () => {
    const prisma = {
      episodeWatch: { findMany: vi.fn().mockResolvedValue([{ id: "s1" }]) },
    } as unknown as PrismaService;

    const valid = await XP_VERIFIERS[XpReason.EPISODE_WATCHED]!(prisma, [
      entry({ id: "kept", sourceId: "s1" }),
      entry({ id: "stale", sourceId: "gone" }),
    ]);

    expect([...valid]).toEqual(["kept"]);
  });

  it("queries nothing for an empty batch", async () => {
    const findMany = vi.fn();
    const prisma = { episodeWatch: { findMany } } as unknown as PrismaService;

    const valid = await XP_VERIFIERS[XpReason.EPISODE_WATCHED]!(prisma, []);

    expect(findMany).not.toHaveBeenCalled();
    expect(valid.size).toBe(0);
  });

  it("deduplicates repeated sources within one batch", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "s1" }]);
    const prisma = { episodeWatch: { findMany } } as unknown as PrismaService;

    await XP_VERIFIERS[XpReason.EPISODE_WATCHED]!(prisma, [
      entry({ id: "a", sourceId: "s1" }),
      entry({ id: "b", sourceId: "s1" }),
    ]);

    expect(findMany.mock.calls[0][0].where.id.in).toEqual(["s1"]);
  });
});

describe("XP_VERIFIERS — status predicates", () => {
  it("drops an entry whose source exists but no longer qualifies", async () => {
    // A movie un-marked as completed keeps its LibraryEntry row; existence
    // alone would leave the XP standing.
    const prisma = {
      libraryEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: "s1", status: "COMPLETED" },
          { id: "s2", status: "WATCHING" },
        ]),
      },
    } as unknown as PrismaService;

    const valid = await XP_VERIFIERS[XpReason.MOVIE_WATCHED]!(prisma, [
      entry({ id: "kept", sourceId: "s1" }),
      entry({ id: "stale", sourceId: "s2" }),
    ]);

    expect([...valid]).toEqual(["kept"]);
  });

  it("drops a tombstoned comment, which still has a row", async () => {
    const prisma = {
      comment: {
        findMany: vi.fn().mockResolvedValue([
          { id: "s1", deletedAt: null, text: "a comment long enough to count" },
          { id: "s2", deletedAt: new Date(), text: null },
          { id: "s3", deletedAt: null, text: "court" },
        ]),
      },
    } as unknown as PrismaService;

    const valid = await XP_VERIFIERS[XpReason.COMMENT_POSTED]!(prisma, [
      entry({ id: "kept", sourceId: "s1" }),
      entry({ id: "deleted", sourceId: "s2" }),
      entry({ id: "tooShort", sourceId: "s3" }),
    ]);

    expect([...valid]).toEqual(["kept"]);
  });

  it("drops a review vote flipped from UP to DOWN in place", async () => {
    const prisma = {
      reviewVote: {
        findMany: vi.fn().mockResolvedValue([{ id: "s1", value: "DOWN" }]),
      },
    } as unknown as PrismaService;

    const valid = await XP_VERIFIERS[XpReason.REVIEW_VOTE_RECEIVED]!(prisma, [
      entry({ sourceId: "s1" }),
    ]);

    expect(valid.size).toBe(0);
  });
});

describe("XP_VERIFIERS — per-user reasons", () => {
  it("judges the same source separately for each user", async () => {
    // The trap the entry-id return value exists for: two users credited
    // SEASON_COMPLETED on one season, only one of them still qualifying.
    // Keying the answer by source id would have conflated them.
    const season = {
      number: 2,
      episodes: [{ id: "ep1", airDate: new Date("2020-01-01") }],
    };
    const prisma = {
      season: { findUnique: vi.fn().mockResolvedValue(season) },
      episodeWatch: {
        findMany: vi.fn(({ where }: { where: { userId: string } }) =>
          Promise.resolve(
            where.userId === "watcher" ? [{ episodeId: "ep1" }] : [],
          ),
        ),
      },
    } as unknown as PrismaService;

    const valid = await XP_VERIFIERS[XpReason.SEASON_COMPLETED]!(prisma, [
      entry({ id: "stillValid", sourceId: "season-1", userId: "watcher" }),
      entry({ id: "nowStale", sourceId: "season-1", userId: "quitter" }),
    ]);

    expect([...valid]).toEqual(["stillValid"]);
  });
});

describe("XP_VERIFIERS — reasons that never go stale", () => {
  it("keeps every entry without touching the database", async () => {
    const prisma = {} as unknown as PrismaService;
    const batch = [entry({ id: "a" }), entry({ id: "b" })];

    for (const reason of [
      XpReason.DOMAIN_STARTED,
      XpReason.IMPORT_COMPLETED,
      XpReason.ACHIEVEMENT_UNLOCKED,
    ]) {
      const valid = await XP_VERIFIERS[reason]!(prisma, batch);
      expect([...valid].sort()).toEqual(["a", "b"]);
    }
  });
});

describe("XP_VERIFIERS — WORK_ADDED", () => {
  it("looks in all four entry tables, once each", async () => {
    const empty = vi.fn().mockResolvedValue([]);
    const prisma = {
      libraryEntry: { findMany: empty },
      gameEntry: { findMany: vi.fn().mockResolvedValue([{ id: "s1" }]) },
      bookEntry: { findMany: empty },
      musicEntry: { findMany: empty },
    } as unknown as PrismaService;

    const valid = await XP_VERIFIERS[XpReason.WORK_ADDED]!(prisma, [
      entry({ id: "kept", sourceId: "s1" }),
      entry({ id: "stale", sourceId: "s2" }),
    ]);

    expect([...valid]).toEqual(["kept"]);
    expect((prisma.gameEntry.findMany as Mock).mock.calls).toHaveLength(1);
  });
});
