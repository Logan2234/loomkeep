import { XpReason } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
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

// No Unleash client configured in tests — isEnabled always returns whatever
// fallback the caller passed, exactly like the real FeatureFlagsService with
// no UNLEASH_API_URL set.
function makeFlags(): FeatureFlagsService {
  return {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;
}

function makeService(configValues: Record<string, string> = {}) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }) },
    xpEntry: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    userScore: { upsert: vi.fn().mockResolvedValue({}) },
    // Only exercised by reconcile()'s default EPISODE_WATCHED verifier,
    // which reads the whole batch in one findMany.
    episodeWatch: { findMany: vi.fn().mockResolvedValue([]) },
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
  const flags = makeFlags();
  const jobRuns = {
    record: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as JobRunService;

  const service = new XpService(prisma, config, flags, jobRuns);
  return { service, prisma, config, flags, jobRuns };
}

describe("XpService.award", () => {
  it("credits an XP entry and recomputes UserScore", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.aggregate as Mock).mockResolvedValue({
      _sum: { amount: 10 },
    });

    await service.award("user-1", XpReason.EPISODE_WATCHED, "watch-1");

    expect(prisma.xpEntry.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        reason: XpReason.EPISODE_WATCHED,
        sourceType: "EpisodeWatch",
        sourceId: "watch-1",
        amount: 10,
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
    ).resolves.toBeUndefined();
    expect(prisma.userScore.upsert).not.toHaveBeenCalled();
  });

  it("refuses the Nth award of the day once the reason's daily cap is reached", async () => {
    const { service, prisma } = makeService();
    const today = new Array(30)
      .fill(null)
      .map(() => ({ createdAt: new Date() }));
    (prisma.xpEntry.findMany as Mock).mockResolvedValue(today);

    await service.award("user-1", XpReason.EPISODE_WATCHED, "watch-31");

    expect(prisma.xpEntry.create).not.toHaveBeenCalled();
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
    // Each iteration re-reads the day's entries, so the rows written by
    // earlier iterations have to count towards the cap.
    (prisma.xpEntry.findMany as Mock).mockImplementation(() =>
      Promise.resolve(
        Array.from({ length: credited }, () => ({ createdAt: new Date() })),
      ),
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
  it("deletes every XpEntry anchored to the given sources and resums each affected user's score", async () => {
    const { service, prisma } = makeService();
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);

    await service.revokeBySource("EpisodeWatch", ["w1", "w2"]);

    expect(prisma.xpEntry.deleteMany).toHaveBeenCalledWith({
      where: { sourceType: "EpisodeWatch", sourceId: { in: ["w1", "w2"] } },
    });
    expect(prisma.userScore.upsert).toHaveBeenCalledTimes(2);
  });

  it("does nothing for an empty source list", async () => {
    const { service, prisma } = makeService();

    await service.revokeBySource("EpisodeWatch", []);

    expect(prisma.xpEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("revokes and recomputes on the caller's transaction", async () => {
    const { service, prisma } = makeService();
    const tx = {
      xpEntry: {
        findMany: vi.fn().mockResolvedValue([{ userId: "user-1" }]),
        deleteMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 7 } }),
      },
      userScore: { upsert: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await service.revokeBySource("Review", ["rev1"], tx);

    expect(tx.xpEntry.deleteMany).toHaveBeenCalled();
    expect(tx.userScore.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: { xp: 7 },
      create: { userId: "user-1", xp: 7 },
    });
    expect(prisma.xpEntry.deleteMany).not.toHaveBeenCalled();
  });
});

describe("XpService.reconcile", () => {
  it("deletes an orphaned XpEntry (source no longer justifies it) and never credits", async () => {
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
    expect(prisma.xpEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["xp-1"] } },
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
    expect(prisma.xpEntry.deleteMany).not.toHaveBeenCalled();
  });
});
