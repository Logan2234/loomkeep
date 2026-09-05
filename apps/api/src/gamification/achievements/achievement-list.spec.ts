import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
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
  const flags = {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;

  const service = new AchievementService(
    prisma,
    config,
    flags,
    {} as unknown as XpService,
    {} as unknown as JobRunService,
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
    });
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
