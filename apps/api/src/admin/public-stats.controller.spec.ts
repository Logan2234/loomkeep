import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { AdminService } from "./admin.service";
import { PublicStatsController } from "./public-stats.controller";
import type { UpdateCheckService } from "./update-check.service";

const UP_TO_DATE = {
  enabled: true,
  currentVersion: "1.11.0",
  latestVersion: "1.11.0",
  updateAvailable: false,
  checkedAt: "2026-10-20T05:30:00.000Z",
  lastCheckFailed: false,
};

function makeController(
  counts: {
    userCount: number;
    openReports: number;
    newUsers7d: number;
  },
  services: {
    comingSoon?: boolean;
    configured: boolean;
    reachable: boolean | null;
  }[] = [],
  update = UP_TO_DATE,
) {
  const userCountMock = vi
    .fn()
    .mockResolvedValueOnce(counts.userCount)
    .mockResolvedValueOnce(counts.newUsers7d);
  const prisma = {
    user: { count: userCountMock },
    report: { count: vi.fn().mockResolvedValue(counts.openReports) },
  } as unknown as PrismaService;
  const admin = {
    getServicesStatus: vi
      .fn()
      .mockResolvedValue({ services, checkedAt: new Date().toISOString() }),
  } as unknown as AdminService;
  const updateCheck = {
    status: vi.fn().mockResolvedValue(update),
  } as unknown as UpdateCheckService;
  return new PublicStatsController(prisma, admin, updateCheck);
}

describe("PublicStatsController.getSummary", () => {
  const ORIGINAL_ENV = process.env.GIT_SHA;

  afterEach(() => {
    process.env.GIT_SHA = ORIGINAL_ENV;
  });

  it("truncates GIT_SHA to 7 characters", async () => {
    process.env.GIT_SHA = "a1b2c3d4e5f6";
    const controller = makeController({
      userCount: 3,
      openReports: 1,
      newUsers7d: 2,
    });
    await expect(controller.getSummary()).resolves.toEqual({
      status: "ok",
      userCount: 3,
      openReports: 1,
      newUsers7d: 2,
      operational: "0/0",
      gitSha: "a1b2c3d",
      version: "1.11.0",
      latestVersion: "1.11.0",
      updateAvailable: "no",
    });
  });

  it('falls back to "unknown" when GIT_SHA isn\'t set', async () => {
    delete process.env.GIT_SHA;
    const controller = makeController({
      userCount: 0,
      openReports: 0,
      newUsers7d: 0,
    });
    await expect(controller.getSummary()).resolves.toEqual({
      status: "ok",
      userCount: 0,
      openReports: 0,
      newUsers7d: 0,
      operational: "0/0",
      gitSha: "unknown",
      version: "1.11.0",
      latestVersion: "1.11.0",
      updateAvailable: "no",
    });
  });

  it("counts configured-and-reachable-or-unprobed services, excluding comingSoon", async () => {
    const zeroCounts = {
      userCount: 0,
      openReports: 0,
      newUsers7d: 0,
    };
    const controller = makeController(zeroCounts, [
      { configured: true, reachable: true }, // healthy
      { configured: true, reachable: null }, // unprobeable but configured — healthy
      { configured: true, reachable: false }, // probed down — unhealthy
      { configured: false, reachable: null }, // not configured — unhealthy
      { configured: false, reachable: null, comingSoon: true }, // excluded entirely
    ]);
    await expect(controller.getSummary()).resolves.toMatchObject({
      operational: "2/4",
    });
  });

  it("flags a newer published version for the widget", async () => {
    const controller = makeController(
      { userCount: 0, openReports: 0, newUsers7d: 0 },
      [],
      { ...UP_TO_DATE, latestVersion: "1.12.0", updateAvailable: true },
    );
    await expect(controller.getSummary()).resolves.toMatchObject({
      latestVersion: "1.12.0",
      updateAvailable: "yes",
    });
  });

  it("says unknown when the check is off, whatever an older check found", async () => {
    const controller = makeController(
      { userCount: 0, openReports: 0, newUsers7d: 0 },
      [],
      {
        ...UP_TO_DATE,
        enabled: false,
        latestVersion: "1.12.0",
        updateAvailable: true,
      },
    );
    await expect(controller.getSummary()).resolves.toMatchObject({
      latestVersion: "unknown",
      updateAvailable: "unknown",
    });
  });
});
