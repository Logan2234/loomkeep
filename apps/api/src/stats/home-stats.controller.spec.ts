import { ErrorCode } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { ProfileService } from "../social/profile.service";
import { HomeStatsController } from "./home-stats.controller";
import type { HomeStatsService } from "./home-stats.service";

const FIGURES = {
  thisYear: {
    year: 2026,
    video: { movies: 3, episodes: 40, minutes: 900 },
    games: { finished: 1, minutes: 300 },
  },
  allTime: {
    video: { movies: 80, episodes: 900, minutes: 30000 },
    games: { finished: 12, minutes: 9000 },
  },
};

function makeController(
  visibility: { isSelf: boolean; domains: string[] },
  socialEnabled = "true",
) {
  return new HomeStatsController(
    {
      profileFigures: vi.fn().mockResolvedValue(FIGURES),
    } as unknown as HomeStatsService,
    {
      libraryVisibility: vi
        .fn()
        .mockResolvedValue({ userId: "target", ...visibility }),
    } as unknown as ProfileService,
    {
      get: vi.fn((key: string) =>
        key === "SOCIAL_ENABLED" ? socialEnabled : undefined,
      ),
    } as unknown as ConfigService,
  );
}

const viewer = { sub: "viewer" } as never;

describe("HomeStatsController.profileFigures", () => {
  it("keeps a domain only where the viewer may see that library", async () => {
    const controller = makeController({ isSelf: false, domains: ["MEDIA"] });

    await expect(
      controller.profileFigures(viewer, "alice", "2026"),
    ).resolves.toEqual({
      thisYear: { year: 2026, video: FIGURES.thisYear.video },
      allTime: { video: FIGURES.allTime.video },
    });
  });

  it("shows you all of your own, whatever your privacy settings", async () => {
    const controller = makeController({ isSelf: true, domains: [] });

    await expect(
      controller.profileFigures(viewer, "me", "2026"),
    ).resolves.toEqual(FIGURES);
  });

  it("hides someone else's figures when social features are off", async () => {
    const controller = makeController(
      { isSelf: false, domains: ["MEDIA"] },
      "false",
    );

    await expect(
      controller.profileFigures(viewer, "alice", "2026"),
    ).rejects.toMatchObject({ code: ErrorCode.UserNotFound });
  });
});
