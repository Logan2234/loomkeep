import { type Mock, vi } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { ReportService } from "./report.service";

function make(
  overrides: Partial<Record<string, Partial<Record<string, Mock>>>> = {},
) {
  const prisma = {
    report: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...overrides.report,
    },
    comment: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.comment,
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.user,
    },
    mediaItem: { findUnique: vi.fn().mockResolvedValue(null) },
    gameItem: { findUnique: vi.fn().mockResolvedValue(null) },
    bookItem: { findUnique: vi.fn().mockResolvedValue(null) },
    musicItem: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  const mail = {
    sendReportsDigest: vi.fn(),
  } as unknown as MailService;
  const jobRuns = {
    record: vi.fn((_key, fn) => fn()),
  } as unknown as JobRunService;
  const notifications = {
    create: vi.fn(),
  } as unknown as NotificationService;

  return {
    svc: new ReportService(prisma, mail, jobRuns, notifications),
    prisma,
    mail,
    notifications,
  };
}

describe("ReportService.create", () => {
  it("persists a report with a valid category/motif pair", async () => {
    const { svc, prisma } = make();
    await svc.create(
      "reporter1",
      "COMMENT" as never,
      "c1",
      "SPAM" as never,
      "SPAM_PROMOTIONAL" as never,
    );
    expect(prisma.report.create).toHaveBeenCalledWith({
      data: {
        reporterId: "reporter1",
        targetType: "COMMENT",
        targetId: "c1",
        category: "SPAM",
        motif: "SPAM_PROMOTIONAL",
        reason: null,
      },
    });
  });

  it("persists OTHER with a trimmed reason and no motif", async () => {
    const { svc, prisma } = make();
    await svc.create(
      "reporter1",
      "COMMENT" as never,
      "c1",
      "OTHER" as never,
      undefined,
      "  something specific  ",
    );
    expect(prisma.report.create).toHaveBeenCalledWith({
      data: {
        reporterId: "reporter1",
        targetType: "COMMENT",
        targetId: "c1",
        category: "OTHER",
        motif: null,
        reason: "something specific",
      },
    });
  });

  it("rejects OTHER with no reason", async () => {
    const { svc } = make();
    await expect(
      svc.create("reporter1", "COMMENT" as never, "c1", "OTHER" as never),
    ).rejects.toThrow();
  });

  it("rejects a motif that doesn't belong to the given category", async () => {
    const { svc } = make();
    await expect(
      svc.create(
        "reporter1",
        "COMMENT" as never,
        "c1",
        "SPAM" as never,
        "HARASSMENT_INSULTS" as never,
      ),
    ).rejects.toThrow();
  });

  it("rejects a non-OTHER category with no motif", async () => {
    const { svc } = make();
    await expect(
      svc.create("reporter1", "COMMENT" as never, "c1", "SPAM" as never),
    ).rejects.toThrow();
  });
});

describe("ReportService.list — target resolution", () => {
  it("resolves a COMMENT target to an excerpt", async () => {
    const { svc } = make({
      report: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "r1",
            targetType: "COMMENT",
            targetId: "c1",
            reason: null,
            status: "PENDING",
            createdAt: new Date(),
            resolvedAt: null,
            reporter: {
              id: "u1",
              username: "u1",
              displayName: "U1",
              profileAccess: "PUBLIC",
            },
          },
        ]),
      },
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          text: "this is spam",
          deletedAt: null,
          targetType: "MEDIA",
          targetId: "m1",
          author: { username: "spammer" },
        }),
      },
    });
    const page = await svc.list(undefined, 1);
    expect(page.items[0].target?.targetOwnerUsername).toBe("spammer");
    expect(page.items[0].target?.label).toContain("this is spam");
  });

  it("shows a tombstone label for an already-deleted comment", async () => {
    const { svc } = make({
      report: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "r1",
            targetType: "COMMENT",
            targetId: "c1",
            reason: null,
            status: "PENDING",
            createdAt: new Date(),
            resolvedAt: null,
            reporter: {
              id: "u1",
              username: "u1",
              displayName: "U1",
              profileAccess: "PUBLIC",
            },
          },
        ]),
      },
      comment: {
        findUnique: vi.fn().mockResolvedValue({
          text: null,
          deletedAt: new Date(),
          targetType: "MEDIA",
          targetId: "m1",
          author: { username: "spammer" },
        }),
      },
    });
    const page = await svc.list(undefined, 1);
    expect(page.items[0].target?.label).toContain("commentaire supprimé");
  });
});

describe("ReportService.findOne", () => {
  it("returns the target type/id for takedown routing", async () => {
    const { svc } = make({
      report: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ targetType: "COMMENT", targetId: "c1" }),
      },
    });
    await expect(svc.findOne("r1")).resolves.toEqual({
      targetType: "COMMENT",
      targetId: "c1",
    });
  });

  it("returns null for an unknown report", async () => {
    const { svc } = make();
    await expect(svc.findOne("missing")).resolves.toBeNull();
  });
});

describe("ReportService.resolve", () => {
  it("throws when the report is not (still) pending", async () => {
    const { svc } = make({
      report: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });
    await expect(svc.resolve("admin1", "r1", "RESOLVED")).rejects.toThrow();
  });

  it("marks a pending report resolved", async () => {
    const { svc, prisma } = make();
    await svc.resolve("admin1", "r1", "RESOLVED");
    expect(prisma.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1", status: "PENDING" },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolvedById: "admin1",
        }),
      }),
    );
  });

  it("notifies the reporter in-app of the outcome, DSA art. 16(5)", async () => {
    const { svc, notifications } = make({
      report: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ reporterId: "reporter1" }),
      },
    });
    await svc.resolve("admin1", "r1", "DISMISSED");
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "reporter1",
        type: "REPORT_RESOLVED",
      }),
    );
  });

  it("skips the reporter notification when the reporter's account is gone", async () => {
    const { svc, notifications } = make({
      report: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ reporterId: null }),
      },
    });
    await svc.resolve("admin1", "r1", "RESOLVED");
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe("ReportService.list — reporterId filter", () => {
  it("adds reporterId to the where clause when provided", async () => {
    const { svc, prisma } = make();
    await svc.list("PENDING", 1, "reporter1");
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING", reporterId: "reporter1" },
      }),
    );
  });

  it("omits reporterId from the where clause when not provided", async () => {
    const { svc, prisma } = make();
    await svc.list("PENDING", 1);
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } }),
    );
  });
});

describe("ReportService.listAgainstUser", () => {
  it("matches reports targeting the user directly or a comment they authored", async () => {
    const { svc, prisma } = make({
      comment: { findMany: vi.fn().mockResolvedValue([{ id: "c1" }]) },
    });
    await svc.listAgainstUser("user1");
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { targetType: "USER", targetId: "user1" },
            { targetType: "COMMENT", targetId: { in: ["c1"] } },
          ],
        },
      }),
    );
  });
});

describe("ReportService.sendDailyDigest", () => {
  it("sends nothing when there are no pending reports", async () => {
    const { svc, mail } = make({
      report: { count: vi.fn().mockResolvedValue(0) },
    });
    const sent = await svc.sendDailyDigest();
    expect(sent).toBe(0);
    expect(mail.sendReportsDigest).not.toHaveBeenCalled();
  });

  it("emails every admin the pending count", async () => {
    const { svc, prisma, mail } = make({
      report: { count: vi.fn().mockResolvedValue(2) },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { email: "a@x.com", locale: "fr" },
          { email: "b@x.com", locale: "en" },
        ]),
      },
    });
    const sent = await svc.sendDailyDigest();
    expect(sent).toBe(2);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: "ADMIN" } }),
    );
    expect(mail.sendReportsDigest).toHaveBeenCalledWith(
      { email: "a@x.com", locale: "fr" },
      2,
    );
    expect(mail.sendReportsDigest).toHaveBeenCalledWith(
      { email: "b@x.com", locale: "en" },
      2,
    );
  });
});
