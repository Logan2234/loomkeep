import type { MailService } from "../mail/mail.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import { ModerationDecisionService } from "./moderation-decision.service";

function make() {
  const prisma = {
    moderationDecision: { create: jest.fn() },
  } as unknown as PrismaService;
  const mail = {
    sendModerationDecision: jest.fn(),
  } as unknown as MailService;
  const notifications = { create: jest.fn() } as unknown as NotificationService;

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
      "alice@example.com",
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
});
