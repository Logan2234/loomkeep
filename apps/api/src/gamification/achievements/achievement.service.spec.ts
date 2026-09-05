import { ErrorCode } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import type { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import type { JobRunService } from "../../jobs/job-run.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { XpService } from "../xp.service";
import { AchievementService } from "./achievement.service";

// A socialGated achievement to exercise the [G3]-reserved gate — none of
// this ticket's own registry entries (first_episode, cinephile_*) use it.
const { socialGatedCheck } = vi.hoisted(() => ({
  socialGatedCheck: vi.fn(),
}));

vi.mock("./registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./registry")>();
  const socialGatedDefinition = {
    key: "test_social_gated",
    xpAward: 10,
    socialGated: true,
    check: socialGatedCheck,
  };
  return {
    ...actual,
    ACHIEVEMENTS: {
      ...actual.ACHIEVEMENTS,
      test_social_gated: socialGatedDefinition,
    },
    ACHIEVEMENT_LIST: [...actual.ACHIEVEMENT_LIST, socialGatedDefinition],
  };
});

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
// fallback the caller passed, same convention as xp.service.spec.ts.
function makeFlags(): FeatureFlagsService {
  return {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;
}

function makeService(configValues: Record<string, string> = {}) {
  const prisma = {
    userAchievement: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "achievement-1" }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    episodeWatch: { findFirst: vi.fn().mockResolvedValue(null) },
    libraryEntry: { count: vi.fn().mockResolvedValue(0) },
    xpEntry: { findMany: vi.fn().mockResolvedValue([]) },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ timezone: "Europe/Paris" }),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
  const config = makeConfig({ GAMIFICATION_ENABLED: "true", ...configValues });
  const flags = makeFlags();
  const xp = { award: vi.fn() } as unknown as XpService;
  const jobRuns = {
    record: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as JobRunService;

  const service = new AchievementService(prisma, config, flags, xp, jobRuns);
  return { service, prisma, config, flags, xp, jobRuns };
}

describe("AchievementService.evaluate", () => {
  it("unlocks a satisfied achievement, credits its xpAward via amountOverride, sourced from the created row's id", async () => {
    const { service, prisma, xp } = makeService();
    (prisma.episodeWatch.findFirst as Mock).mockResolvedValue({ id: "w1" });

    await service.evaluate("user-1", ["first_episode"]);

    expect(prisma.userAchievement.create).toHaveBeenCalledWith({
      data: { userId: "user-1", key: "first_episode" },
    });
    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      "ACHIEVEMENT_UNLOCKED",
      "achievement-1",
      50,
    );
  });

  it("does not even call check() when the achievement is already unlocked", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findMany as Mock).mockResolvedValue([
      { key: "first_episode" },
    ]);

    await service.evaluate("user-1", ["first_episode"]);

    expect(prisma.episodeWatch.findFirst).not.toHaveBeenCalled();
    expect(prisma.userAchievement.create).not.toHaveBeenCalled();
  });

  it("stays locked when the check reports unlocked: false", async () => {
    const { service, prisma, xp } = makeService();
    (prisma.episodeWatch.findFirst as Mock).mockResolvedValue(null);

    await service.evaluate("user-1", ["first_episode"]);

    expect(prisma.userAchievement.create).not.toHaveBeenCalled();
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("no-ops entirely (no read, no write) when GAMIFICATION_ENABLED is off", async () => {
    const { service, prisma } = makeService({ GAMIFICATION_ENABLED: "false" });

    await service.evaluate("user-1");

    expect(prisma.userAchievement.findUnique).not.toHaveBeenCalled();
  });

  it("never unlocks a socialGated achievement while SOCIAL_ENABLED is off", async () => {
    const { service, prisma, xp } = makeService();
    socialGatedCheck.mockResolvedValue({ unlocked: true });

    await service.evaluate("user-1", ["test_social_gated"]);

    expect(socialGatedCheck).not.toHaveBeenCalled();
    expect(prisma.userAchievement.create).not.toHaveBeenCalled();
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("credits no XP when create() hits the unique constraint (concurrent unlock)", async () => {
    const { service, prisma, xp } = makeService();
    (prisma.episodeWatch.findFirst as Mock).mockResolvedValue({ id: "w1" });
    (prisma.userAchievement.create as Mock).mockRejectedValue(
      uniqueConstraintError(),
    );

    await expect(
      service.evaluate("user-1", ["first_episode"]),
    ).resolves.toBeUndefined();
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("evaluates only the registry entries named by `keys`", async () => {
    const { service, prisma } = makeService();

    await service.evaluate("user-1", ["first_episode"]);

    // One batched lookup for the whole set, scoped to the named keys —
    // cinephile's tiers and the socialGated fixture never reach the query.
    // It used to be one findUnique per candidate, which is what made marking
    // an episode watched (18 keys) take about a second.
    expect(prisma.userAchievement.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.userAchievement.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", key: { in: ["first_episode"] } },
      select: { key: true },
    });
  });
});

describe("AchievementService.markVersionLinkClicked", () => {
  it("grants curious_cat directly, without asking its check()", async () => {
    const { service, prisma, xp } = makeService();
    (prisma.userAchievement.create as Mock).mockResolvedValue({
      id: "achievement-1",
    });

    await service.markVersionLinkClicked("user-1");

    expect(prisma.userAchievement.create).toHaveBeenCalledWith({
      data: { userId: "user-1", key: "curious_cat" },
    });
    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      "ACHIEVEMENT_UNLOCKED",
      "achievement-1",
      50,
    );
  });

  it("is idempotent — recalling it never re-credits an already-unlocked curious_cat", async () => {
    const { service, prisma, xp } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      id: "achievement-1",
    });

    await service.markVersionLinkClicked("user-1");
    await service.markVersionLinkClicked("user-1");

    expect(prisma.userAchievement.create).not.toHaveBeenCalled();
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("does nothing when gamification is disabled", async () => {
    const { service, prisma } = makeService({ GAMIFICATION_ENABLED: "false" });

    await service.markVersionLinkClicked("user-1");

    expect(prisma.userAchievement.findUnique).not.toHaveBeenCalled();
    expect(prisma.userAchievement.create).not.toHaveBeenCalled();
  });
});

describe("AchievementService.pending", () => {
  it("returns unlocked-but-undisplayed achievements, oldest first, with xpAwarded looked up from the matching XpEntry", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findMany as Mock).mockResolvedValue([
      {
        id: "achievement-1",
        key: "first_episode",
        unlockedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      { sourceId: "achievement-1", amount: 50 },
    ]);

    await expect(service.pending("user-1")).resolves.toEqual([
      {
        id: "achievement-1",
        key: "first_episode",
        unlockedAt: "2026-01-01T00:00:00.000Z",
        xpAwarded: 50,
      },
    ]);
    expect(prisma.userAchievement.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", displayedAt: null },
      orderBy: { unlockedAt: "asc" },
    });
  });

  it("returns an empty list (not an error) when GAMIFICATION_ENABLED is off", async () => {
    const { service, prisma } = makeService({ GAMIFICATION_ENABLED: "false" });

    await expect(service.pending("user-1")).resolves.toEqual([]);
    expect(prisma.userAchievement.findMany).not.toHaveBeenCalled();
  });
});

describe("AchievementService.markDisplayed", () => {
  it("404s on an achievement belonging to another user", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      userId: "someone-else",
      displayedAt: null,
    });

    await expect(
      service.markDisplayed("user-1", "achievement-1"),
    ).rejects.toThrow();
    expect(prisma.userAchievement.update).not.toHaveBeenCalled();
  });

  it("404s on an unknown id", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue(null);

    await expect(service.markDisplayed("user-1", "missing")).rejects.toThrow();
  });

  it("sets displayedAt on first call", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      displayedAt: null,
    });

    await service.markDisplayed("user-1", "achievement-1");

    expect(prisma.userAchievement.update).toHaveBeenCalledWith({
      where: { id: "achievement-1" },
      data: { displayedAt: expect.any(Date) },
    });
  });

  it("is idempotent: a second call is a no-op, not an error", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      displayedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(
      service.markDisplayed("user-1", "achievement-1"),
    ).resolves.toBeUndefined();
    expect(prisma.userAchievement.update).not.toHaveBeenCalled();
  });
});

describe("AchievementService.equip/unequip", () => {
  it("equips an unlocked, non-secret achievement", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      id: "achievement-1",
    });
    (prisma.user.findUnique as Mock).mockResolvedValue({
      equippedBadgeKeys: [],
    });

    await expect(service.equip("user-1", "first_episode")).resolves.toEqual([
      "first_episode",
    ]);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { equippedBadgeKeys: ["first_episode"] },
    });
  });

  it("is idempotent when the key is already equipped", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      id: "achievement-1",
    });
    (prisma.user.findUnique as Mock).mockResolvedValue({
      equippedBadgeKeys: ["first_episode"],
    });

    await expect(service.equip("user-1", "first_episode")).resolves.toEqual([
      "first_episode",
    ]);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("404s when the achievement isn't unlocked", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue(null);

    await expect(
      service.equip("user-1", "first_episode"),
    ).rejects.toMatchObject({
      code: ErrorCode.GamificationAchievementNotFound,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a secret achievement — equipping it would put it on display", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      id: "achievement-1",
    });

    await expect(service.equip("user-1", "curious_cat")).rejects.toMatchObject({
      code: ErrorCode.GamificationBadgeSecret,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a 4th badge once 3 are already equipped, without auto-swapping any of them", async () => {
    const { service, prisma } = makeService();
    (prisma.userAchievement.findUnique as Mock).mockResolvedValue({
      id: "achievement-1",
    });
    (prisma.user.findUnique as Mock).mockResolvedValue({
      equippedBadgeKeys: ["a", "b", "c"],
    });

    await expect(
      service.equip("user-1", "first_episode"),
    ).rejects.toMatchObject({ code: ErrorCode.GamificationBadgeLimitReached });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("unequips a key that's currently equipped", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue({
      equippedBadgeKeys: ["first_episode", "cinephile_bronze"],
    });

    await expect(service.unequip("user-1", "first_episode")).resolves.toEqual([
      "cinephile_bronze",
    ]);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { equippedBadgeKeys: ["cinephile_bronze"] },
    });
  });

  it("unequip is a no-op when the key isn't equipped", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue({
      equippedBadgeKeys: ["cinephile_bronze"],
    });

    await expect(service.unequip("user-1", "first_episode")).resolves.toEqual([
      "cinephile_bronze",
    ]);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
