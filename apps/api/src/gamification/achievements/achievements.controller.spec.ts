import { vi } from "vitest";
import type { AchievementService } from "./achievement.service";
import { AchievementsController } from "./achievements.controller";

function makeController() {
  const achievements = {
    list: vi.fn().mockResolvedValue([]),
    pending: vi.fn().mockResolvedValue([]),
    markDisplayed: vi.fn(),
    markVersionLinkClicked: vi.fn(),
  } as unknown as AchievementService;

  const controller = new AchievementsController(achievements);
  return { controller, achievements };
}

const USER = { sub: "user-1" } as never;

describe("AchievementsController.list", () => {
  it("delegates to AchievementService.list, scoped to the current user", async () => {
    const { controller, achievements } = makeController();
    const catalogue = [
      {
        key: "first_episode",
        family: "volume" as const,
        tierOf: null,
        tier: null,
        xpAward: 50,
        secret: false,
        unlocked: true,
        unlockedAt: "2026-01-01T00:00:00.000Z",
        progress: null,
      },
    ];
    (achievements.list as ReturnType<typeof vi.fn>).mockResolvedValue(
      catalogue,
    );

    await expect(controller.list(USER)).resolves.toEqual(catalogue);
    expect(achievements.list).toHaveBeenCalledWith("user-1");
  });
});

describe("AchievementsController.pending", () => {
  it("delegates to AchievementService.pending, scoped to the current user", async () => {
    const { controller, achievements } = makeController();
    const pending = [
      {
        id: "achievement-1",
        key: "first_episode",
        unlockedAt: "2026-01-01T00:00:00.000Z",
        xpAwarded: 50,
      },
    ];
    (achievements.pending as ReturnType<typeof vi.fn>).mockResolvedValue(
      pending,
    );

    await expect(controller.pending(USER)).resolves.toEqual(pending);
    expect(achievements.pending).toHaveBeenCalledWith("user-1");
  });
});

describe("AchievementsController.markDisplayed", () => {
  it("delegates to AchievementService.markDisplayed, scoped to the current user", async () => {
    const { controller, achievements } = makeController();

    await controller.markDisplayed(USER, "achievement-1");

    expect(achievements.markDisplayed).toHaveBeenCalledWith(
      "user-1",
      "achievement-1",
    );
  });

  it("propagates the 404 AchievementService throws for someone else's achievement", async () => {
    const { controller, achievements } = makeController();
    (achievements.markDisplayed as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("not found"),
    );

    await expect(
      controller.markDisplayed(USER, "achievement-1"),
    ).rejects.toThrow();
  });
});

describe("AchievementsController.signalVersionLinkClicked", () => {
  it("delegates to AchievementService.markVersionLinkClicked, scoped to the current user", async () => {
    const { controller, achievements } = makeController();

    await controller.signalVersionLinkClicked(USER);

    expect(achievements.markVersionLinkClicked).toHaveBeenCalledWith("user-1");
  });
});
