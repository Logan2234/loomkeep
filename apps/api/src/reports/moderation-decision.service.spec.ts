import type { Prisma } from "@prisma/client";
import { vi } from "vitest";
import type { MailService } from "../mail/mail.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { ModerationDecisionService } from "./moderation-decision.service";

function make() {
  const prisma = {
    moderationDecision: { create: vi.fn() },
    moderationEmailOutbox: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ attempts: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        locale: "en",
        decision: {
          subjectEmail: "alice@example.com",
          measure: "COMMENT_REMOVED",
          reasonText: "Insultes répétées.",
          legalBasis: "TOS_BREACH",
          tosClause: "§7 — Règles de conduite",
        },
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
  const mail = {
    sendModerationDecision: vi.fn(),
  } as unknown as MailService;
  const notifications = {
    create: vi.fn(),
    createInTransaction: vi.fn().mockResolvedValue(true),
    publishCreated: vi.fn(),
  } as unknown as NotificationService;

  return {
    svc: new ModerationDecisionService(prisma, mail, notifications),
    prisma,
    mail,
    notifications,
  };
}

const BASE_INPUT = {
  measure: "COMMENT_REMOVED" as const,
  targetType: "COMMENT" as const,
  targetId: "c1",
  subjectUserId: "u1",
  subjectEmail: "alice@example.com",
  subjectLocale: "en",
  subjectUsername: "alice",
  legalBasis: "TOS_BREACH" as const,
  reasonText: "Insultes répétées.",
  tosClause: "§7 — Règles de conduite",
  contentSnapshot: "le commentaire original",
  decidedById: "admin1",
  reportId: "r1",
};

describe("ModerationDecisionService.record", () => {
  it("persists the decision, emails the notice, and posts an in-app notification for a comment removal", async () => {
    const { svc, prisma, mail, notifications } = make();

    await svc.record(BASE_INPUT);

    expect(prisma.moderationDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        measure: "COMMENT_REMOVED",
        subjectUserId: "u1",
        subjectEmail: "alice@example.com",
        reasonText: "Insultes répétées.",
        tosClause: "§7 — Règles de conduite",
        contentSnapshot: "le commentaire original",
        decidedById: "admin1",
        reportId: "r1",
      }),
    });
    expect(mail.sendModerationDecision).toHaveBeenCalledWith(
      { email: "alice@example.com", locale: "en" },
      expect.objectContaining({
        measure: "COMMENT_REMOVED",
        reasonText: "Insultes répétées.",
        legalBasis: "TOS_BREACH",
        tosClause: "§7 — Règles de conduite",
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "MODERATION_ACTION" }),
    );
  });

  it("emails but skips the in-app notification for an account deletion (no account left to show it to)", async () => {
    const { svc, mail, notifications } = make();

    await svc.record({ ...BASE_INPUT, measure: "ACCOUNT_DELETED" });

    expect(mail.sendModerationDecision).toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("titles the in-app notice after the removed content type", async () => {
    const { svc, notifications } = make();

    await svc.record({ ...BASE_INPUT, measure: "REVIEW_REMOVED" as const });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Une de tes critiques a été retirée" }),
    );
  });
});

describe("ModerationDecisionService queued report notice", () => {
  it("persists the decision, email outbox and in-app notice in the caller's transaction", async () => {
    const { svc, mail, notifications } = make();
    const tx = {
      moderationDecision: {
        create: vi.fn().mockResolvedValue({ id: "decision1" }),
      },
      moderationEmailOutbox: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(svc.queueForReport(tx, BASE_INPUT)).resolves.toBe("decision1");
    expect(tx.moderationDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reportId: "r1" }),
      select: { id: true },
    });
    expect(tx.moderationEmailOutbox.create).toHaveBeenCalledWith({
      data: { decisionId: "decision1", locale: "en" },
    });
    expect(notifications.createInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: "u1",
        type: "MODERATION_ACTION",
        dedupeKey: "moderation:r1",
      }),
    );
    expect(mail.sendModerationDecision).not.toHaveBeenCalled();
  });

  it("marks a claimed notice sent after SMTP succeeds", async () => {
    const { svc, prisma, mail } = make();

    await svc.deliver("decision1");

    expect(mail.sendModerationDecision).toHaveBeenCalledOnce();
    expect(prisma.moderationEmailOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ decisionId: "decision1" }),
        data: expect.objectContaining({ sentAt: expect.any(Date) }),
      }),
    );
  });

  it("keeps a failed SMTP notice available for retry without throwing", async () => {
    const { svc, prisma, mail } = make();
    vi.mocked(mail.sendModerationDecision).mockRejectedValue(
      new Error("SMTP unavailable"),
    );

    await expect(svc.deliver("decision1")).resolves.toBeUndefined();
    expect(prisma.moderationEmailOutbox.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextAttemptAt: expect.any(Date),
          lastError: "SMTP unavailable",
        }),
      }),
    );
  });

  it("replays due notices during the scheduled sweep", async () => {
    const { svc, prisma, mail } = make();
    vi.mocked(prisma.moderationEmailOutbox.findMany).mockResolvedValue([
      { decisionId: "decision1" },
    ] as never);

    await svc.dispatchPending();

    expect(mail.sendModerationDecision).toHaveBeenCalledOnce();
  });

  it("does not send when another dispatcher holds the lease", async () => {
    const { svc, prisma, mail } = make();
    vi.mocked(prisma.moderationEmailOutbox.updateMany).mockResolvedValueOnce({
      count: 0,
    });

    await svc.deliver("decision1");

    expect(mail.sendModerationDecision).not.toHaveBeenCalled();
  });
});
