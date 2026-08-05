import type { CommentService } from "../comments/comment.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReportService } from "../reports/report.service";
import { AdminReportsController } from "./admin-reports.controller";

function makeController(
  overrides: {
    findOne?: jest.Mock;
  } = {},
) {
  const reports = {
    findOne:
      overrides.findOne ??
      jest.fn().mockResolvedValue({ targetType: "COMMENT", targetId: "c1" }),
    resolve: jest.fn(),
  } as unknown as ReportService;

  const comments = {
    adminRemove: jest.fn(),
  } as unknown as CommentService;

  const prisma = {
    report: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  const controller = new AdminReportsController(reports, comments, prisma);
  return { controller, reports, comments, prisma };
}

const ADMIN = { sub: "admin1" } as never;

describe("AdminReportsController.takeDown", () => {
  it("removes the comment then resolves the report, for a COMMENT target", async () => {
    const { controller, reports, comments } = makeController();

    await controller.takeDown(ADMIN, "r1");

    expect(comments.adminRemove).toHaveBeenCalledWith("c1");
    expect(reports.resolve).toHaveBeenCalledWith("admin1", "r1", "RESOLVED");
  });

  it("resolves without touching a comment for a non-COMMENT target", async () => {
    const { controller, reports, comments } = makeController({
      findOne: jest
        .fn()
        .mockResolvedValue({ targetType: "USER", targetId: "u1" }),
    });

    await controller.takeDown(ADMIN, "r1");

    expect(comments.adminRemove).not.toHaveBeenCalled();
    expect(reports.resolve).toHaveBeenCalledWith("admin1", "r1", "RESOLVED");
  });

  it("404s on an unknown report", async () => {
    const { controller } = makeController({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await expect(controller.takeDown(ADMIN, "missing")).rejects.toThrow();
  });
});

describe("AdminReportsController.summary", () => {
  it("counts the whole queue and ranks the reporters", async () => {
    const { controller, prisma } = makeController();
    (prisma.report.count as jest.Mock)
      .mockResolvedValueOnce(2) // pending
      .mockResolvedValueOnce(7) // resolved
      .mockResolvedValueOnce(3); // dismissed
    (prisma.report.findMany as jest.Mock).mockResolvedValue([
      {
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        resolvedAt: new Date("2026-07-01T04:00:00.000Z"),
      },
    ]);
    (prisma.report.groupBy as jest.Mock).mockResolvedValue([
      { reporterId: "u1", _count: { _all: 8 } },
      { reporterId: "u2", _count: { _all: 1 } },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "u1", username: "logan" },
      { id: "u2", username: "mira" },
    ]);

    await expect(controller.summary()).resolves.toEqual({
      pending: 2,
      resolved: 7,
      dismissed: 3,
      medianResolutionHours: 4,
      foundedPercent: 70,
      topReporters: [
        { username: "logan", reports: 8 },
        { username: "mira", reports: 1 },
      ],
    });
  });
});
