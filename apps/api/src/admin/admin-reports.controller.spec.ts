import type { CommentService } from "../comments/comment.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import type { ModerationDecisionService } from "../reports/moderation-decision.service";
import type { ReportService } from "../reports/report.service";
import { AdminReportsController } from "./admin-reports.controller";

const REASON_BODY: ModerationReasonBody = {
  reasonText: "Insultes répétées envers un autre utilisateur.",
  legalBasis: "TOS_BREACH",
  tosClause: "§7 — Règles de conduite",
};

function makeController(
  overrides: {
    findOne?: jest.Mock;
    adminRemove?: jest.Mock;
    findUniqueUser?: jest.Mock;
  } = {},
) {
  const reports = {
    findOne:
      overrides.findOne ??
      jest.fn().mockResolvedValue({
        targetType: "COMMENT",
        targetId: "c1",
        category: "HARASSMENT",
        motif: "HARASSMENT_INSULTS",
      }),
    resolve: jest.fn(),
  } as unknown as ReportService;

  const comments = {
    adminRemove:
      overrides.adminRemove ??
      jest.fn().mockResolvedValue({ authorId: "author1", text: "commentaire" }),
  } as unknown as CommentService;

  const prisma = {
    report: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique:
        overrides.findUniqueUser ??
        jest.fn().mockResolvedValue({
          email: "author@example.com",
          username: "author1",
        }),
    },
  } as unknown as PrismaService;

  const moderationDecisions = {
    record: jest.fn(),
  } as unknown as ModerationDecisionService;

  const controller = new AdminReportsController(
    reports,
    comments,
    prisma,
    moderationDecisions,
  );
  return { controller, reports, comments, prisma, moderationDecisions };
}

const ADMIN = { sub: "admin1" } as never;

describe("AdminReportsController.takeDown", () => {
  it("removes the comment, records+notifies the moderation decision, then resolves the report", async () => {
    const { controller, reports, comments, moderationDecisions } =
      makeController();

    await controller.takeDown(ADMIN, "r1", REASON_BODY);

    expect(comments.adminRemove).toHaveBeenCalledWith("c1");
    expect(moderationDecisions.record).toHaveBeenCalledWith(
      expect.objectContaining({
        measure: "COMMENT_REMOVED",
        targetType: "COMMENT",
        targetId: "c1",
        subjectUserId: "author1",
        subjectEmail: "author@example.com",
        subjectUsername: "author1",
        reasonCategory: "HARASSMENT",
        reasonMotif: "HARASSMENT_INSULTS",
        reasonText: REASON_BODY.reasonText,
        contentSnapshot: "commentaire",
        decidedById: "admin1",
        reportId: "r1",
      }),
    );
    expect(reports.resolve).toHaveBeenCalledWith("admin1", "r1", "RESOLVED");
  });

  it("skips the notice when the comment's author account is already gone", async () => {
    const { controller, moderationDecisions } = makeController({
      adminRemove: jest
        .fn()
        .mockResolvedValue({ authorId: null, text: "commentaire" }),
    });

    await controller.takeDown(ADMIN, "r1", REASON_BODY);

    expect(moderationDecisions.record).not.toHaveBeenCalled();
  });

  it("resolves without touching a comment for a non-COMMENT target", async () => {
    const { controller, reports, comments, moderationDecisions } =
      makeController({
        findOne: jest.fn().mockResolvedValue({
          targetType: "USER",
          targetId: "u1",
          category: null,
          motif: null,
        }),
      });

    await controller.takeDown(ADMIN, "r1", REASON_BODY);

    expect(comments.adminRemove).not.toHaveBeenCalled();
    expect(moderationDecisions.record).not.toHaveBeenCalled();
    expect(reports.resolve).toHaveBeenCalledWith("admin1", "r1", "RESOLVED");
  });

  it("404s on an unknown report", async () => {
    const { controller } = makeController({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await expect(
      controller.takeDown(ADMIN, "missing", REASON_BODY),
    ).rejects.toThrow();
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
