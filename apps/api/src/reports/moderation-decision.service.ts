import {
  ModerationLegalBasis,
  ModerationMeasure,
  NotificationType,
  type ReportCategory,
  type ReportMotif,
  type ReportTargetType,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { MailService } from "../mail/mail.service";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordModerationDecisionInput {
  measure: ModerationMeasure;
  targetType: ReportTargetType;
  targetId: string;
  subjectUserId: string;
  subjectEmail: string;
  subjectUsername: string;
  legalBasis: ModerationLegalBasis;
  reasonCategory?: ReportCategory | null;
  reasonMotif?: ReportMotif | null;
  reasonText: string;
  tosClause: string;
  /** COMMENT_REMOVED only: the comment's text before the tombstone nulled it. */
  contentSnapshot?: string | null;
  decidedById: string;
  reportId?: string | null;
}

/**
 * DSA art. 17: persists the "statement of reasons" for a restrictive measure
 * and notifies the sanctioned user. Email always fires; the in-app bell only
 * for measures that leave an account behind to show it to — ACCOUNT_DELETED
 * has none by the time this runs (see admin-users.controller.ts deleteUser,
 * which calls this before the actual `user.delete`).
 */
@Injectable()
export class ModerationDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  async record(input: RecordModerationDecisionInput): Promise<void> {
    await this.prisma.moderationDecision.create({
      data: {
        measure: input.measure,
        targetType: input.targetType,
        targetId: input.targetId,
        subjectUserId: input.subjectUserId,
        subjectEmail: input.subjectEmail,
        subjectUsername: input.subjectUsername,
        legalBasis: input.legalBasis,
        reasonCategory: input.reasonCategory ?? null,
        reasonMotif: input.reasonMotif ?? null,
        reasonText: input.reasonText,
        tosClause: input.tosClause,
        contentSnapshot: input.contentSnapshot ?? null,
        decidedById: input.decidedById,
        reportId: input.reportId ?? null,
      },
    });

    await this.mail.sendModerationDecision(input.subjectEmail, {
      measure: input.measure,
      reasonText: input.reasonText,
      legalBasis: input.legalBasis,
      tosClause: input.tosClause,
    });

    if (input.measure !== ModerationMeasure.ACCOUNT_DELETED) {
      await this.notifications.create({
        userId: input.subjectUserId,
        type: NotificationType.MODERATION_ACTION,
        title: this.notificationTitle(input.measure),
        body: input.reasonText,
        url: "/app/settings",
      });
    }
  }

  private notificationTitle(measure: ModerationMeasure): string {
    return measure === ModerationMeasure.COMMENT_REMOVED
      ? "Un de tes commentaires a été retiré"
      : "Une mesure a été prise sur ton compte";
  }
}
