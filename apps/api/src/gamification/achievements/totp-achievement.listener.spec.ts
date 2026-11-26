import { vi } from "vitest";
import { TotpEnabledEvent } from "../../auth/auth.events";
import type { AchievementService } from "./achievement.service";
import { TotpAchievementListener } from "./totp-achievement.listener";

describe("TotpAchievementListener", () => {
  it("evaluates locked_down for the user who confirmed an authenticator", async () => {
    const achievements = {
      evaluate: vi.fn().mockResolvedValue(undefined),
    } as unknown as AchievementService;

    await new TotpAchievementListener(achievements).onTotpEnabled(
      new TotpEnabledEvent("user-1"),
    );

    expect(achievements.evaluate).toHaveBeenCalledWith("user-1", [
      "locked_down",
    ]);
  });
});
