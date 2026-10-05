import { XpReason } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
import type { PrismaService } from "../prisma/prisma.service";
import { XpService } from "./xp.service";

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function makeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function makeService(configValues: Record<string, string> = {}) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }) },
    xpEntry: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    userScore: { upsert: vi.fn().mockResolvedValue({}) },
    // Read by reconcile()'s EPISODE_WATCHED verifier and by the subject
    // snapshot taken when an episode is credited.
    episodeWatch: { findMany: vi.fn().mockResolvedValue([]) },
    mediaItem: { findMany: vi.fn().mockResolvedValue([]) },
    gameItem: { findMany: vi.fn().mockResolvedValue([]) },
    bookItem: { findMany: vi.fn().mockResolvedValue([]) },
    musicItem: { findMany: vi.fn().mockResolvedValue([]) },
    gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
    bookEntry: { findMany: vi.fn().mockResolvedValue([]) },
    gamePlaythrough: { findMany: vi.fn().mockResolvedValue([]) },
    bookReading: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
    season: { findMany: vi.fn().mockResolvedValue([]) },
    episode: { findMany: vi.fn().mockResolvedValue([]) },
    // Capped reasons credit inside a transaction (advisory lock, see
    // creditEntry) — hand the callback the same mock so the spies below
    // still see the writes.
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
  } as unknown as PrismaService;

  (prisma.$transaction as Mock).mockImplementation(
    (fn: (tx: PrismaService) => unknown) => fn(prisma),
  );
  const config = makeConfig({ GAMIFICATION_ENABLED: "true", ...configValues });
  const jobRuns = {
    record: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as JobRunService;

  const service = new XpService(prisma, config, jobRuns);
  return { service, prisma, config, jobRuns };
}

describe("XpService.award", () => {
  it("credits an XP entry with what earned it, and recomputes UserScore", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.aggregate as Mock).mockResolvedValue({
      _sum: { amount: 10 },
    });
    (prisma.episodeWatch.findMany as Mock).mockResolvedValue([
      {
        id: "watch-1",
        episode: { number: 2, season: { number: 3, mediaItemId: "media-1" } },
      },
    ]);
    (prisma.mediaItem.findMany as Mock).mockResolvedValue([
      {
        id: "media-1",
        title: "The Bear",
        type: "SERIES",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "136315" }],
      },
    ]);

    await service.award("user-1", XpReason.EPISODE_WATCHED, "watch-1");

    expect(prisma.xpEntry.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        reason: XpReason.EPISODE_WATCHED,
        sourceType: "EpisodeWatch",
        sourceId: "watch-1",
        amount: 10,
        title: "The Bear",
        href: "/app/media/series/136315",
        data: { seasonNumber: 3, episodeNumber: 2 },
      },
    });
    expect(prisma.userScore.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: { xp: 10 },
      create: { userId: "user-1", xp: 10 },
    });
  });

  it("is idempotent: a P2002 unique-constraint hit is swallowed, not thrown, and never recomputes the score", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.create as Mock).mockRejectedValue(uniqueConstraintError());

    await expect(
      service.award("user-1", XpReason.EPISODE_WATCHED, "watch-1"),
    ).resolves.toBe(false);
    expect(prisma.userScore.upsert).not.toHaveBeenCalled();
  });

  it("refuses the Nth award of the day once the reason's daily cap is reached", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.count as Mock).mockResolvedValue(30);

    await service.award("user-1", XpReason.EPISODE_WATCHED, "watch-31");

    expect(prisma.xpEntry.create).not.toHaveBeenCalled();
  });

  it("counts the cap over the last 24 hours, so switching timezone can't open a new day", async () => {
    // Entries earned 20h ago fall on "yesterday" by the calendar, which a
    // timezone change can move at will: the window ignores the calendar.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));

    try {
      const { service, prisma } = makeService();

      await service.award("user-1", XpReason.EPISODE_WATCHED, "watch-31");

      expect(prisma.xpEntry.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: { gte: new Date("2026-10-04T10:00:00Z") },
        }),
      });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is a full no-op when GAMIFICATION_ENABLED is off", async () => {
    const { service, prisma } = makeService({ GAMIFICATION_ENABLED: "false" });

    await service.award("user-1", XpReason.EPISODE_WATCHED, "watch-1");

    expect(prisma.xpEntry.create).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("is a no-op for a socialGated reason when SOCIAL_ENABLED is off", async () => {
    const { service, prisma } = makeService(); // SOCIAL_ENABLED unset -> off

    await service.award("user-1", XpReason.COMMENT_POSTED, "comment-1");

    expect(prisma.xpEntry.create).not.toHaveBeenCalled();
  });

  it("credits a socialGated reason once SOCIAL_ENABLED is on", async () => {
    const { service, prisma } = makeService({ SOCIAL_ENABLED: "true" });

    await service.award("user-1", XpReason.COMMENT_POSTED, "comment-1");

    expect(prisma.xpEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: XpReason.COMMENT_POSTED }),
      }),
    );
  });
});

describe("XpService.award — first finishes", () => {
  // The libraries credit a first finish with the playthrough's (or reading's)
  // id and revoke it by that table: the entry must be anchored there too, or
  // un-finishing the game leaves its XP in place until the nightly sweep.
  it.each([
    [XpReason.GAME_FINISHED, "GamePlaythrough"],
    [XpReason.BOOK_FINISHED, "BookReading"],
  ])("anchors %s on the cycle it is credited for", async (reason, table) => {
    const { service, prisma } = makeService();

    await service.award("user-1", reason, "cycle-1");

    expect(prisma.xpEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceType: table, sourceId: "cycle-1" }),
    });
  });
});

describe("XpService.award — daily cap under concurrency", () => {
  it("counts and inserts inside one advisory-locked transaction", async () => {
    // Reading the day's count on one connection and inserting on another is
    // a TOCTOU: two parallel awards both see the cap as not yet reached and
    // both credit. The unique constraint can't catch it — different sources.
    const { service, prisma } = makeService();

    await service.award("user-1", XpReason.EPISODE_WATCHED, "watch-1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [[sql]] = (prisma.$executeRaw as Mock).mock.calls;
    expect(sql.join("?")).toContain("pg_advisory_xact_lock");
  });

  it("skips the lock for a reason that has no cap", async () => {
    // DOMAIN_STARTED is unique per (user, domain): nothing to count first,
    // and the unique constraint already makes it idempotent. Locking it
    // would be a transaction per milestone for nothing.
    const { service, prisma } = makeService();

    await service.award("user-1", XpReason.DOMAIN_STARTED, "SERIES");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.xpEntry.create).toHaveBeenCalled();
  });
});

describe("XpService.awardMany", () => {
  it("resums the score once for the whole batch, not once per entry", async () => {
    // recomputeScore scans the user's entire ledger, so the batch must pay
    // that cost once rather than once per episode.
    const { service, prisma } = makeService();

    await service.awardMany("user-1", XpReason.EPISODE_WATCHED, [
      "watch-1",
      "watch-2",
      "watch-3",
    ]);

    expect(prisma.xpEntry.create).toHaveBeenCalledTimes(3);
    expect(prisma.xpEntry.aggregate).toHaveBeenCalledTimes(1);
    expect(prisma.userScore.upsert).toHaveBeenCalledTimes(1);
  });

  it("looks up what earned the batch once, not once per entry", async () => {
    const { service, prisma } = makeService();

    await service.awardMany("user-1", XpReason.EPISODE_WATCHED, [
      "watch-1",
      "watch-2",
    ]);

    expect(prisma.episodeWatch.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not resum at all when nothing was credited", async () => {
    const { service, prisma } = makeService({ GAMIFICATION_ENABLED: "false" });

    await service.awardMany("user-1", XpReason.EPISODE_WATCHED, ["watch-1"]);

    expect(prisma.xpEntry.create).not.toHaveBeenCalled();
    expect(prisma.userScore.upsert).not.toHaveBeenCalled();
  });

  it("stops crediting once the day's cap is reached mid-batch", async () => {
    const { service, prisma } = makeService();
    const cap = 30;
    let credited = 0;
    // Each iteration re-counts the window, so the rows written by earlier
    // iterations have to count towards the cap.
    (prisma.xpEntry.count as Mock).mockImplementation(() =>
      Promise.resolve(credited),
    );
    (prisma.xpEntry.create as Mock).mockImplementation(() => {
      credited++;
      return Promise.resolve({});
    });

    await service.awardMany(
      "user-1",
      XpReason.EPISODE_WATCHED,
      Array.from({ length: cap + 5 }, (_, i) => `watch-${i}`),
    );

    expect(credited).toBe(cap);
  });
});

describe("XpService.revokeBySource", () => {
  it("stamps every live XpEntry of the given sources revoked, keeping the rows, and resums each affected user's score", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);

    await service.revokeBySource("EpisodeWatch", ["w1", "w2"]);

    expect(prisma.xpEntry.updateMany).toHaveBeenCalledWith({
      where: {
        sourceType: "EpisodeWatch",
        sourceId: { in: ["w1", "w2"] },
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.userScore.upsert).toHaveBeenCalledTimes(2);
  });

  it("leaves revoked entries out of the resummed score", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([{ userId: "user-1" }]);

    await service.revokeBySource("EpisodeWatch", ["w1"]);

    expect(prisma.xpEntry.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      _sum: { amount: true },
    });
  });

  it("does nothing for an empty source list", async () => {
    const { service, prisma } = makeService();

    await service.revokeBySource("EpisodeWatch", []);

    expect(prisma.xpEntry.updateMany).not.toHaveBeenCalled();
  });

  it("revokes and recomputes on the caller's transaction", async () => {
    const { service, prisma } = makeService();
    const tx = {
      xpEntry: {
        findMany: vi.fn().mockResolvedValue([{ userId: "user-1" }]),
        updateMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 7 } }),
      },
      userScore: { upsert: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await service.revokeBySource("Review", ["rev1"], tx);

    expect(tx.xpEntry.updateMany).toHaveBeenCalled();
    expect(tx.userScore.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: { xp: 7 },
      create: { userId: "user-1", xp: 7 },
    });
    expect(prisma.xpEntry.updateMany).not.toHaveBeenCalled();
  });
});

describe("XpService.reconcile", () => {
  it("revokes an orphaned XpEntry (source no longer justifies it) and never credits", async () => {
    const { service, prisma } = makeService();

    (prisma.xpEntry.findMany as Mock).mockImplementation(
      ({ where, skip }: { where: { reason: string }; skip?: number }) => {
        if (skip) return Promise.resolve([]);

        if (where.reason === XpReason.EPISODE_WATCHED) {
          return Promise.resolve([
            { id: "xp-1", sourceId: "watch-missing", userId: "user-1" },
          ]);
        }

        return Promise.resolve([]);
      },
    );

    const result = await service.reconcile();

    expect(result).toEqual({ [XpReason.EPISODE_WATCHED]: 1 });
    expect(prisma.xpEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["xp-1"] } },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.xpEntry.create).not.toHaveBeenCalled();
    expect(prisma.userScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("reports no corrections when every source is still valid", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([]);

    const result = await service.reconcile();

    expect(result).toEqual({});
    expect(prisma.xpEntry.updateMany).not.toHaveBeenCalled();
  });

  it("only verifies live entries: a revoked one is history, not a correction", async () => {
    const { service, prisma } = makeService();

    await service.reconcile();

    for (const [args] of (prisma.xpEntry.findMany as Mock).mock.calls) {
      expect(args.where.revokedAt).toBeNull();
    }
  });
});

describe("XpService.runReconcileJob — subject snapshots", () => {
  it("fills what earned a live entry credited before snapshots existed", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.findMany as Mock).mockImplementation(
      ({ where, skip }: { where: { sourceType?: string }; skip?: number }) =>
        Promise.resolve(
          !skip && where.sourceType === "EpisodeWatch"
            ? [{ id: "xp-1", sourceId: "watch-1" }]
            : [],
        ),
    );
    (prisma.episodeWatch.findMany as Mock).mockResolvedValue([
      {
        id: "watch-1",
        episode: { number: 1, season: { number: 1, mediaItemId: "media-1" } },
      },
    ]);
    (prisma.mediaItem.findMany as Mock).mockResolvedValue([
      {
        id: "media-1",
        title: "Severance",
        type: "SERIES",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "95396" }],
      },
    ]);

    await service.runReconcileJob();

    expect(prisma.xpEntry.update).toHaveBeenCalledWith({
      where: { id: "xp-1" },
      data: {
        title: "Severance",
        href: "/app/media/series/95396",
        data: { seasonNumber: 1, episodeNumber: 1 },
      },
    });
  });
});

describe("XpService.adjust", () => {
  it("writes a signed ADMIN_ADJUSTMENT entry and returns the new total", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.aggregate as Mock).mockResolvedValue({
      _sum: { amount: 120 },
    });

    await expect(service.adjust("u1", -20)).resolves.toBe(100);

    const [[{ data }]] = (prisma.xpEntry.create as Mock).mock.calls;
    expect(data).toMatchObject({
      userId: "u1",
      reason: "ADMIN_ADJUSTMENT",
      sourceType: "AdminAdjustment",
      amount: -20,
    });
    expect(prisma.userScore.upsert).toHaveBeenCalled();
  });

  it("gives every adjustment its own ledger row", async () => {
    const { service, prisma } = makeService();

    await service.adjust("u1", 10);
    await service.adjust("u1", 10);

    const sources = (prisma.xpEntry.create as Mock).mock.calls.map(
      (call) => (call[0] as { data: { sourceId: string } }).data.sourceId,
    );
    expect(new Set(sources).size).toBe(2);
  });

  it("refuses to take the total below zero, and writes nothing", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.aggregate as Mock).mockResolvedValue({
      _sum: { amount: 50 },
    });

    await expect(service.adjust("u1", -51)).rejects.toMatchObject({
      code: "gamification.xp_below_zero",
    });
    expect(prisma.xpEntry.create).not.toHaveBeenCalled();
  });

  it("allows bringing the total exactly to zero", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.aggregate as Mock).mockResolvedValue({
      _sum: { amount: 50 },
    });

    await expect(service.adjust("u1", -50)).resolves.toBe(0);
  });

  it("serialises adjustments of one user under an advisory lock", async () => {
    const { service, prisma } = makeService();

    await service.adjust("u1", 5);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [[sql]] = (prisma.$executeRaw as Mock).mock.calls;
    expect(sql.join("")).toContain("pg_advisory_xact_lock");
  });
});
