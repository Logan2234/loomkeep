import { vi } from "vitest";
import type { AchievementService } from "./achievement.service";
import { AchievementsController } from "./achievements.controller";

function makeController() {
  const achievements = {
    pending: vi.fn().mockResolvedValue([]),
    markDisplayed: vi.fn(),
  } as unknown as AchievementService;

  const controller = new AchievementsController(achievements);
  return { controller, achievements };
}

const USER = { sub: "user-1" } as never;

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
    (
      achievements.markDisplayed as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error("not found"));

    await expect(
      controller.markDisplayed(USER, "achievement-1"),
    ).rejects.toThrow();
  });
});
