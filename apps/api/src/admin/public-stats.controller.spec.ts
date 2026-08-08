import type { PrismaService } from "../prisma/prisma.service";
import { PublicStatsController } from "./public-stats.controller";

function makeController(counts: {
  userCount: number;
  mediaCount: number;
  openReports: number;
  newUsers7d: number;
}) {
  const userCountMock = jest
    .fn()
    .mockResolvedValueOnce(counts.userCount)
    .mockResolvedValueOnce(counts.newUsers7d);
  const prisma = {
    user: { count: userCountMock },
    libraryEntry: { count: jest.fn().mockResolvedValue(counts.mediaCount) },
    report: { count: jest.fn().mockResolvedValue(counts.openReports) },
  } as unknown as PrismaService;
  return new PublicStatsController(prisma);
}

describe("PublicStatsController", () => {
  const ORIGINAL_ENV = process.env.GIT_SHA;

  afterEach(() => {
    process.env.GIT_SHA = ORIGINAL_ENV;
  });

  it("truncates GIT_SHA to 7 characters", async () => {
    process.env.GIT_SHA = "a1b2c3d4e5f6";
    const controller = makeController({
      userCount: 3,
      mediaCount: 12,
      openReports: 1,
      newUsers7d: 2,
    });
    await expect(controller.getSummary()).resolves.toEqual({
      status: "ok",
      userCount: 3,
      mediaCount: 12,
      openReports: 1,
      newUsers7d: 2,
      gitSha: "a1b2c3d",
    });
  });

  it('falls back to "unknown" when GIT_SHA isn\'t set', async () => {
    delete process.env.GIT_SHA;
    const controller = makeController({
      userCount: 0,
      mediaCount: 0,
      openReports: 0,
      newUsers7d: 0,
    });
    await expect(controller.getSummary()).resolves.toEqual({
      status: "ok",
      userCount: 0,
      mediaCount: 0,
      openReports: 0,
      newUsers7d: 0,
      gitSha: "unknown",
    });
  });
});
