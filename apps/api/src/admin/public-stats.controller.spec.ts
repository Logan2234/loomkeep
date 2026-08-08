import type { PrismaService } from "../prisma/prisma.service";
import { PublicStatsController } from "./public-stats.controller";

function makeController(userCount: number) {
  const prisma = {
    user: { count: jest.fn().mockResolvedValue(userCount) },
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
    const controller = makeController(3);
    await expect(controller.getSummary()).resolves.toEqual({
      userCount: 3,
      gitSha: "a1b2c3d",
    });
  });

  it('falls back to "unknown" when GIT_SHA isn\'t set', async () => {
    delete process.env.GIT_SHA;
    const controller = makeController(0);
    await expect(controller.getSummary()).resolves.toEqual({
      userCount: 0,
      gitSha: "unknown",
    });
  });
});
