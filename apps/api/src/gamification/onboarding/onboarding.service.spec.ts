import { ErrorCode } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AchievementService } from "../achievements/achievement.service";
import { OnboardingService } from "./onboarding.service";

const { computeOnboardingDoneMap } = vi.hoisted(() => ({
  computeOnboardingDoneMap: vi.fn(),
}));

vi.mock("./onboarding.util", () => ({ computeOnboardingDoneMap }));

const ALL_DONE = {
  add_title: true,
  mark_complete: true,
  rate: true,
  complete_profile: true,
  import: true,
  create_list: true,
  comment: true,
};

function makeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

// No Unleash client in tests — isEnabled always returns its fallback, same
// convention as achievement.service.spec.ts.
function makeFlags(): FeatureFlagsService {
  return {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;
}

function makeService(
  opts: {
    configValues?: Record<string, string>;
    user?: {
      onboardingSkippedSteps: string[];
      onboardingGamifiedCompletedAt: Date | null;
    };
  } = {},
) {
  // A mutable stand-in for the row, so a `skip()` call's own `update()`
  // is reflected by the `getChecklist()` it chains into right after — same
  // as the real database would, unlike a static mockResolvedValue.
  const user = opts.user ?? {
    onboardingSkippedSteps: [] as string[],
    onboardingGamifiedCompletedAt: null as Date | null,
  };
  const prisma = {
    user: {
      findUniqueOrThrow: vi
        .fn()
        .mockImplementation(() => Promise.resolve(user)),
      update: vi.fn().mockImplementation(({ data }) => {
        Object.assign(user, data);
        return Promise.resolve(user);
      }),
    },
  } as unknown as PrismaService;
  const achievements = {
    evaluate: vi.fn().mockResolvedValue(undefined),
  } as unknown as AchievementService;
  const config = makeConfig({
    GAMIFICATION_ENABLED: "true",
    SOCIAL_ENABLED: "true",
    ...opts.configValues,
  });
  const flags = makeFlags();

  const service = new OnboardingService(prisma, config, flags, achievements);
  return { service, prisma, achievements };
}

describe("OnboardingService.getChecklist", () => {
  beforeEach(() => {
    computeOnboardingDoneMap.mockReset();
    computeOnboardingDoneMap.mockResolvedValue({
      ...ALL_DONE,
      add_title: false,
    });
  });

  it("returns an empty, already-done checklist when gamification is off", async () => {
    const { service, prisma } = makeService({
      configValues: { GAMIFICATION_ENABLED: "false" },
    });

    const result = await service.getChecklist("user-1");

    expect(result).toEqual({ steps: [], allDone: true });
    expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("returns an empty, already-done checklist once completed, without recomputing", async () => {
    const { service, prisma } = makeService({
      user: {
        onboardingSkippedSteps: [],
        onboardingGamifiedCompletedAt: new Date("2026-01-01"),
      },
    });

    const result = await service.getChecklist("user-1");

    expect(result).toEqual({ steps: [], allDone: true });
    expect(computeOnboardingDoneMap).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("auto-skips social-only steps when SOCIAL_ENABLED is off, persisting them once", async () => {
    computeOnboardingDoneMap.mockResolvedValue({
      ...ALL_DONE,
      add_title: false,
    });
    const { service, prisma } = makeService({
      configValues: { SOCIAL_ENABLED: "false" },
    });

    const result = await service.getChecklist("user-1");

    const keys = result.steps.map((s) => s.key);
    expect(keys).not.toContain("create_list");
    expect(keys).not.toContain("comment");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        onboardingSkippedSteps: expect.arrayContaining([
          "create_list",
          "comment",
        ]),
      },
    });
  });

  it("does not re-append social steps already recorded as skipped", async () => {
    const { service, prisma } = makeService({
      configValues: { SOCIAL_ENABLED: "false" },
      user: {
        onboardingSkippedSteps: ["create_list", "comment"],
        onboardingGamifiedCompletedAt: null,
      },
    });

    await service.getChecklist("user-1");

    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboardingSkippedSteps: expect.anything(),
        }),
      }),
    );
  });

  it("marks the step done/locked/current correctly and never done for a not-yet-done step", async () => {
    const { service } = makeService();

    const result = await service.getChecklist("user-1");

    const addTitle = result.steps.find((s) => s.key === "add_title");
    expect(addTitle).toEqual({ key: "add_title", done: false, skipped: false });
    expect(result.allDone).toBe(false);
  });

  it("persists completion and evaluates the completion achievement the first time every step is done", async () => {
    computeOnboardingDoneMap.mockResolvedValue(ALL_DONE);
    const { service, prisma, achievements } = makeService();

    const result = await service.getChecklist("user-1");

    expect(result.allDone).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingGamifiedCompletedAt: expect.any(Date) },
    });
    expect(achievements.evaluate).toHaveBeenCalledWith("user-1", [
      "premiere_seance",
    ]);
  });

  it("treats an explicitly skipped step as satisfying completion", async () => {
    computeOnboardingDoneMap.mockResolvedValue({ ...ALL_DONE, comment: false });
    const { service } = makeService({
      user: {
        onboardingSkippedSteps: ["comment"],
        onboardingGamifiedCompletedAt: null,
      },
    });

    const result = await service.getChecklist("user-1");

    expect(result.allDone).toBe(true);
  });
});

describe("OnboardingService.skip", () => {
  beforeEach(() => {
    computeOnboardingDoneMap.mockReset();
    computeOnboardingDoneMap.mockResolvedValue({
      ...ALL_DONE,
      add_title: false,
    });
  });

  it("rejects an unknown step key", async () => {
    const { service } = makeService();

    await expect(
      service.skip("user-1", "not-a-real-step"),
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidParam,
    });
  });

  it("appends the key to onboardingSkippedSteps and returns the recomputed checklist", async () => {
    const { service, prisma } = makeService();

    const result = await service.skip("user-1", "add_title");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingSkippedSteps: ["add_title"] },
    });
    const addTitle = result.steps.find((s) => s.key === "add_title");
    expect(addTitle?.skipped).toBe(true);
  });

  it("is idempotent — skipping an already-skipped step doesn't append it twice", async () => {
    const { service, prisma } = makeService({
      user: {
        onboardingSkippedSteps: ["add_title"],
        onboardingGamifiedCompletedAt: null,
      },
    });

    await service.skip("user-1", "add_title");

    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: { onboardingSkippedSteps: expect.anything() },
      }),
    );
  });
});
