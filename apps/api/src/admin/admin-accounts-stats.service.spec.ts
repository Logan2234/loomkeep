import { DORMANT_AFTER_DAYS } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminAccountsStatsService } from "./admin-accounts-stats.service";

const DAY_MS = 24 * 60 * 60 * 1000;

// The bucketing maths lives in admin-accounts-stats.util (own spec). What
// this pins is the orchestration the service owns: which window each count
// is read over, and how an instance with no users is reported.
function make(users: unknown[] = []) {
  const prisma = {
    user: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue(users),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    refreshToken: { count: vi.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;

  return { service: new AdminAccountsStatsService(prisma), prisma };
}

/** The `gte` of the first user.count call whose where matches `predicate`. */
function windowOf(
  prisma: PrismaService,
  predicate: (where: Record<string, never>) => boolean,
): Date | undefined {
  const call = (prisma.user.count as Mock).mock.calls.find(
    ([arg]) => arg?.where && predicate(arg.where),
  );
  return call?.[0]?.where?.refreshTokens?.some?.lastUsedAt?.gte;
}

describe("AdminAccountsStatsService health windows", () => {
  it("measures activity over 24h and 30d from session use", async () => {
    // Read from RefreshToken.lastUsedAt, not ActivityEvent: events only exist
    // since P4, so older accounts would otherwise all look dead.
    const { service, prisma } = make();

    await service.getStats();

    const windows = (prisma.user.count as Mock).mock.calls
      .map(([arg]) => arg?.where?.refreshTokens?.some?.lastUsedAt?.gte)
      .filter((d): d is Date => d instanceof Date)
      .map((d) => Math.round((Date.now() - d.getTime()) / DAY_MS));

    expect(windows.sort((a, b) => a - b)).toEqual([1, 30]);
    expect(windowOf(prisma, (w) => "refreshTokens" in w)).toBeInstanceOf(Date);
  });

  it("counts an account that never opened a session as dormant", async () => {
    // `none` rather than a negated `some`: an account with no refresh token
    // at all has to fall on the dormant side, not disappear from both.
    const { service, prisma } = make();

    await service.getStats();

    const dormant = (prisma.user.count as Mock).mock.calls.find(
      ([arg]) => arg?.where?.refreshTokens?.none,
    );
    expect(dormant).toBeDefined();

    const cutoff = dormant![0].where.refreshTokens.none.lastUsedAt.gte as Date;
    expect(Math.round((Date.now() - cutoff.getTime()) / DAY_MS)).toBe(
      DORMANT_AFTER_DAYS,
    );
  });

  it("counts only sessions that have not expired as active", async () => {
    const { service, prisma } = make();

    await service.getStats();

    const [[call]] = (prisma.refreshToken.count as Mock).mock.calls;
    expect(call.where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe("AdminAccountsStatsService on an empty instance", () => {
  it("reports zeroes instead of dividing by no users", async () => {
    const { service } = make([]);

    const stats = await service.getStats();

    expect(stats.total).toBe(0);
    expect(stats.age.birthDateSetPercent).toBe(0);
    expect(stats.age.adultContentPercent).toBe(0);
  });
});
