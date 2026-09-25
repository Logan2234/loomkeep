import { ReportStatus } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi, type Mock } from "vitest";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminSocialStatsService } from "./admin-social-stats.service";

// The maths (median resolution, founded percent, ranking, distribution) lives
// in admin-social-stats.util, which has its own spec. This covers what the
// service decides: the social gate, and which rows each figure is read from.
function make(options: { social?: boolean } = {}) {
  const prisma = {
    review: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    comment: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    report: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    user: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    follow: { count: vi.fn().mockResolvedValue(0) },
    list: { count: vi.fn().mockResolvedValue(0) },
    commentReaction: { count: vi.fn().mockResolvedValue(0) },
    reviewVote: { count: vi.fn().mockResolvedValue(0) },
    block: { count: vi.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;

  const config = { get: vi.fn() } as unknown as ConfigService;
  const flags = {
    isEnabled: vi.fn().mockReturnValue(options.social ?? true),
  } as unknown as FeatureFlagsService;

  return {
    service: new AdminSocialStatsService(prisma, config, flags),
    prisma,
  };
}

describe("AdminSocialStatsService.getSection", () => {
  it("reports the section as disabled without querying anything", async () => {
    // Same guardrail as SocialFeatureGuard: with SOCIAL_ENABLED off there is
    // no social surface to report on, so nothing should be read.
    const { service, prisma } = make({ social: false });

    const section = await service.getSection();

    expect(section).toEqual({ enabled: false });
    expect(prisma.review.count).not.toHaveBeenCalled();
    expect(prisma.report.count).not.toHaveBeenCalled();
  });

  it("returns the full stats when social is on", async () => {
    const { service } = make({ social: true });

    const section = await service.getSection();

    expect(section.enabled).toBe(true);
    expect(section).toHaveProperty("reports");
    expect(section).toHaveProperty("ratings");
  });
});

describe("AdminSocialStatsService.getActivityTrend", () => {
  it("keeps deleted comments in the curve", async () => {
    // A tombstoned comment *was* written; excluding it would rewrite the past
    // every time someone deletes one.
    const { service, prisma } = make();

    await service.getActivityTrend("week");

    const [[call]] = (prisma.comment.findMany as Mock).mock.calls;
    expect(call.where).not.toHaveProperty("deletedAt");
  });

  it("reads both sources over the same window and totals the buckets", async () => {
    const { service, prisma } = make();

    const trend = await service.getActivityTrend("week");

    const reviewWhere = (prisma.review.findMany as Mock).mock.calls[0][0].where;
    const commentWhere = (prisma.comment.findMany as Mock).mock.calls[0][0]
      .where;
    expect(reviewWhere).toEqual(commentWhere);
    expect(trend.total).toBe(trend.points.reduce((sum, p) => sum + p.count, 0));
  });
});

describe("AdminSocialStatsService report figures", () => {
  it("measures resolution time on resolved reports only", async () => {
    const { service, prisma } = make();

    await service.getSection();

    const [[call]] = (prisma.report.findMany as Mock).mock.calls;
    expect(call.where).toEqual({ resolvedAt: { not: null } });
  });

  it("counts pending and resolved separately, by status", async () => {
    const { service, prisma } = make();

    await service.getSection();

    const statuses = (prisma.report.count as Mock).mock.calls.map(
      ([arg]) => arg.where.status,
    );
    expect(statuses).toContain(ReportStatus.PENDING);
    expect(statuses).toContain(ReportStatus.RESOLVED);
    // Dismissed feeds foundedPercent — resolved alone would read as 100%.
    expect(statuses).toContain(ReportStatus.DISMISSED);
  });
});
