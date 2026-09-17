import { vi, type Mock } from "vitest";
import type { CommentService } from "../comments/comment.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import type { ModerationDecisionService } from "../reports/moderation-decision.service";
import type { ReportService } from "../reports/report.service";
import type { ReviewService } from "../reviews/review.service";
import { AdminReportsController } from "./admin-reports.controller";

const REASON_BODY: ModerationReasonBody = {
  reasonText: "Insultes répétées envers un autre utilisateur.",
  legalBasis: "TOS_BREACH",
  tosClause: "§7 — Règles de conduite",
};

function makeController(
  overrides: {
    findOne?: Mock;
    adminRemove?: Mock;
    adminRemoveReview?: Mock;
    findUniqueUser?: Mock;
  } = {},
) {
  const reports = {
    findOne:
      overrides.findOne ??
      vi.fn().mockResolvedValue({
        targetType: "COMMENT",
        targetId: "c1",
        category: "HARASSMENT",
        motif: "HARASSMENT_INSULTS",
      }),
    resolve: vi.fn(),
  } as unknown as ReportService;

  const comments = {
    adminRemove:
      overrides.adminRemove ??
      vi.fn().mockResolvedValue({ authorId: "author1", text: "commentaire" }),
  } as unknown as CommentService;

  const reviews = {
    adminRemove:
      overrides.adminRemoveReview ??
      vi.fn().mockResolvedValue({
        authorId: "author1",
        rating: 1,
        text: "nul, allez voir l'autre film",
      }),
  } as unknown as ReviewService;

  const prisma = {
    report: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique:
        overrides.findUniqueUser ??
        vi.fn().mockResolvedValue({
          email: "author@example.com",
          username: "author1",
        }),
    },
  } as unknown as PrismaService;

  const moderationDecisions = {
    record: vi.fn(),
  } as unknown as ModerationDecisionService;

  const controller = new AdminReportsController(
    reports,
    comments,
    reviews,
    prisma,
    moderationDecisions,
  );
  return {
    controller,
    reports,
    comments,
    reviews,
    prisma,
    moderationDecisions,
  };
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
      adminRemove: vi
        .fn()
        .mockResolvedValue({ authorId: null, text: "commentaire" }),
    });

    await controller.takeDown(ADMIN, "r1", REASON_BODY);

    expect(moderationDecisions.record).not.toHaveBeenCalled();
  });

  it("resolves without touching a comment for a non-COMMENT target", async () => {
    const { controller, reports, comments, moderationDecisions } =
      makeController({
        findOne: vi.fn().mockResolvedValue({
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

  it("removes a reported review and records its rating and text as the snapshot", async () => {
    const { controller, reports, comments, reviews, moderationDecisions } =
      makeController({
        findOne: vi.fn().mockResolvedValue({
          targetType: "REVIEW",
          targetId: "rev1",
          category: "MISLEADING_REVIEW",
          motif: "MISLEADING_REVIEW_OFF_TOPIC",
        }),
      });

    await controller.takeDown(ADMIN, "r1", REASON_BODY);

    expect(reviews.adminRemove).toHaveBeenCalledWith("rev1");
    expect(comments.adminRemove).not.toHaveBeenCalled();
    expect(moderationDecisions.record).toHaveBeenCalledWith(
      expect.objectContaining({
        measure: "REVIEW_REMOVED",
        targetType: "REVIEW",
        targetId: "rev1",
        subjectUserId: "author1",
        reasonMotif: "MISLEADING_REVIEW_OFF_TOPIC",
        contentSnapshot: "1/10 — nul, allez voir l'autre film",
      }),
    );
    expect(reports.resolve).toHaveBeenCalledWith("admin1", "r1", "RESOLVED");
  });

  it("snapshots a text-less review as its rating alone", async () => {
    const { controller, moderationDecisions } = makeController({
      findOne: vi.fn().mockResolvedValue({
        targetType: "REVIEW",
        targetId: "rev1",
        category: "MISLEADING_REVIEW",
        motif: "MISLEADING_REVIEW_MANIPULATION",
      }),
      adminRemoveReview: vi
        .fn()
        .mockResolvedValue({ authorId: "author1", rating: 0, text: null }),
    });

    await controller.takeDown(ADMIN, "r1", REASON_BODY);

    expect(moderationDecisions.record).toHaveBeenCalledWith(
      expect.objectContaining({ contentSnapshot: "0/10" }),
    );
  });

  it("404s on an unknown report", async () => {
    const { controller } = makeController({
      findOne: vi.fn().mockResolvedValue(null),
    });

    await expect(
      controller.takeDown(ADMIN, "missing", REASON_BODY),
    ).rejects.toThrow();
  });
});

describe("AdminReportsController.summary", () => {
  it("counts the whole queue and ranks the reporters", async () => {
    const { controller, prisma } = makeController();
    (prisma.report.count as Mock)
      .mockResolvedValueOnce(2) // pending
      .mockResolvedValueOnce(7) // resolved
      .mockResolvedValueOnce(3); // dismissed
    (prisma.report.findMany as Mock).mockResolvedValue([
      {
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        resolvedAt: new Date("2026-07-01T04:00:00.000Z"),
      },
    ]);
    (prisma.report.groupBy as Mock).mockResolvedValue([
      { reporterId: "u1", _count: { _all: 8 } },
      { reporterId: "u2", _count: { _all: 1 } },
    ]);
    (prisma.user.findMany as Mock).mockResolvedValue([
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
