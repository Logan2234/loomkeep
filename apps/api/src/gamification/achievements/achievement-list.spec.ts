import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { EventsGateway } from "../../events/events.gateway";
import type { JobRunService } from "../../jobs/job-run.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { XpService } from "../xp.service";
import { AchievementService } from "./achievement.service";

// A hand-built miniature catalogue rather than the real ~66-entry registry:
// list() runs every check() it doesn't mask, and the real ones each need a
// full Prisma surface. One entry per shape this method has to handle.
const { plainCheck, tieredCheck, secretCheck, socialCheck } = vi.hoisted(
  () => ({
    plainCheck: vi.fn(),
    tieredCheck: vi.fn(),
    secretCheck: vi.fn(),
    socialCheck: vi.fn(),
  }),
);

vi.mock("./registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./registry")>();
  const definitions = [
    { key: "test_plain", family: "ritual", xpAward: 50, check: plainCheck },
    {
      key: "test_tiered_silver",
      family: "volume",
      tierOf: "test_tiered",
      tier: "silver",
      xpAward: 150,
      check: tieredCheck,
    },
    {
      key: "test_secret",
      family: "misc",
      xpAward: 400,
      secret: true,
      check: secretCheck,
    },
    {
      key: "test_social",
      family: "social",
      xpAward: 50,
      socialGated: true,
      check: socialCheck,
    },
  ];
  return {
    ...actual,
    ACHIEVEMENTS: Object.fromEntries(definitions.map((d) => [d.key, d])),
    ACHIEVEMENT_LIST: definitions,
  };
});

function makeService(configValues: Record<string, string> = {}) {
  const prisma = {
    userAchievement: { findMany: vi.fn().mockResolvedValue([]) },
    achievementRarity: { findMany: vi.fn().mockResolvedValue([]) },
    user: {
      findUnique: vi.fn().mockResolvedValue({ equippedBadgeKeys: [] }),
    },
  } as unknown as PrismaService;
  const config = {
    get: vi.fn(
      (key: string) =>
        ({
          GAMIFICATION_ENABLED: "true",
          SOCIAL_ENABLED: "true",
          ...configValues,
        })[key],
    ),
  } as unknown as ConfigService;

  const service = new AchievementService(
    prisma,
    config,
    {} as unknown as XpService,
    {} as unknown as JobRunService,
    { emitToUser: vi.fn() } as unknown as EventsGateway,
  );
  return { service, prisma };
}

beforeEach(() => {
  vi.clearAllMocks();
  plainCheck.mockResolvedValue({ unlocked: true });
  tieredCheck.mockResolvedValue({
    unlocked: false,
    progress: { current: 68, target: 200 },
  });
  secretCheck.mockResolvedValue({ unlocked: false });
  socialCheck.mockResolvedValue({ unlocked: false });
});

describe("AchievementService.list", () => {
  it("masks every revealing field of a locked secret, and never runs its check", async () => {
    const { service } = makeService();

    const list = await service.list("user-1");

    expect(list.find((a) => a.family === "misc")).toEqual({
      key: null,
      family: "misc",
      tierOf: null,
      tier: null,
      xpAward: null,
      secret: true,
      unlocked: false,
      unlockedAt: null,
      progress: null,
      equipped: false,
      rarity: null,
    });
    // The key alone would reveal the achievement (the web resolves its name
    // from an i18n catalogue indexed by it), so nothing may leak — not even
    // through a progress figure.
    expect(secretCheck).not.toHaveBeenCalled();
  });

  it("returns a secret in full once it is unlocked", async () => {
    const { service, prisma } = makeService();
    (
      prisma.userAchievement.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      { key: "test_secret", unlockedAt: new Date("2026-01-02T03:04:05Z") },
    ]);
    secretCheck.mockResolvedValue({ unlocked: true });

    const list = await service.list("user-1");

    expect(list.find((a) => a.key === "test_secret")).toMatchObject({
      key: "test_secret",
      xpAward: 400,
      secret: true,
      unlocked: true,
      unlockedAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it("carries tier metadata and progress on a tiered entry", async () => {
    const { service } = makeService();

    const list = await service.list("user-1");

    expect(list.find((a) => a.key === "test_tiered_silver")).toEqual({
      key: "test_tiered_silver",
      family: "volume",
      tierOf: "test_tiered",
      tier: "silver",
      xpAward: 150,
      secret: false,
      unlocked: false,
      unlockedAt: null,
      progress: { current: 68, target: 200 },
      equipped: false,
      rarity: null,
    });
  });

  it("gives each achievement its share from the nightly snapshot, a masked secret's too", async () => {
    const { service, prisma } = makeService();
    (
      prisma.achievementRarity.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      { key: "test_plain", holders: 40, eligibleUsers: 1000 },
      { key: "test_secret", holders: 2, eligibleUsers: 1000 },
    ]);

    const list = await service.list("user-1");

    expect(list.find((a) => a.key === "test_plain")?.rarity).toEqual({
      percent: 4,
      upperBound: false,
    });
    expect(list.find((a) => a.family === "misc")?.rarity).toEqual({
      percent: 1,
      upperBound: true,
    });
    expect(list.find((a) => a.key === "test_tiered_silver")?.rarity).toBeNull();
  });

  it("returns null progress for an on/off achievement", async () => {
    const { service } = makeService();

    const list = await service.list("user-1");

    expect(list.find((a) => a.key === "test_plain")?.progress).toBeNull();
  });

  it("omits socialGated entries when social is disabled", async () => {
    const { service } = makeService({ SOCIAL_ENABLED: "false" });

    const list = await service.list("user-1");

    expect(list.map((a) => a.key)).not.toContain("test_social");
    expect(socialCheck).not.toHaveBeenCalled();
  });

  it("returns an empty list when gamification is disabled", async () => {
    const { service } = makeService({ GAMIFICATION_ENABLED: "false" });

    await expect(service.list("user-1")).resolves.toEqual([]);
  });
});
