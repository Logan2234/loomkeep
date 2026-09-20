import {
  ModerationLegalBasis,
  ModerationMeasure,
  NotificationType,
  type ReportCategory,
  type ReportMotif,
  type ReportTargetType,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordModerationDecisionInput {
  measure: ModerationMeasure;
  targetType: ReportTargetType;
  targetId: string;
  subjectUserId: string;
  subjectEmail: string;
  subjectLocale: string;
  subjectUsername: string;
  legalBasis: ModerationLegalBasis;
  reasonCategory?: ReportCategory | null;
  reasonMotif?: ReportMotif | null;
  reasonText: string;
  tosClause: string;
  /** Content removals only: what the removed content said (for a review, its rating too). */
  contentSnapshot?: string | null;
  decidedById: string;
  reportId?: string | null;
}

/**
 * DSA art. 17: persists the "statement of reasons" for a restrictive measure
 * and notifies the sanctioned user. Report takedowns persist the decision
 * before attempting email delivery; account deletion still uses `record`.
 * The in-app bell is only for measures that leave an account behind.
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
      data: this.decisionData(input),
    });

    await this.sendEmail(input);

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

  async recordForReportInTransaction(
    tx: Prisma.TransactionClient,
    input: RecordModerationDecisionInput & { reportId: string },
  ): Promise<void> {
    await tx.moderationDecision.create({
      data: this.decisionData(input),
    });
    await this.notifications.createInTransaction(tx, {
      userId: input.subjectUserId,
      type: NotificationType.MODERATION_ACTION,
      title: this.notificationTitle(input.measure),
      body: input.reasonText,
      url: "/app/settings",
      dedupeKey: `moderation:${input.reportId}`,
    });
  }

  publishForReport(userId: string): void {
    this.notifications.publishCreated(
      userId,
      NotificationType.MODERATION_ACTION,
    );
  }

  sendEmail(input: RecordModerationDecisionInput): Promise<void> {
    return this.mail.sendModerationDecision(
      { email: input.subjectEmail, locale: input.subjectLocale },
      {
        measure: input.measure,
        reasonText: input.reasonText,
        legalBasis: input.legalBasis,
        tosClause: input.tosClause,
      },
    );
  }

  private decisionData(
    input: RecordModerationDecisionInput,
  ): Prisma.ModerationDecisionUncheckedCreateInput {
    return {
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
    };
  }

  private notificationTitle(measure: ModerationMeasure): string {
    switch (measure) {
      case ModerationMeasure.COMMENT_REMOVED:
        return "Un de tes commentaires a été retiré";
      case ModerationMeasure.REVIEW_REMOVED:
        return "Une de tes critiques a été retirée";
      default:
        return "Une mesure a été prise sur ton compte";
    }
  }
}
