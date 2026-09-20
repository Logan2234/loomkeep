import {
  ModerationLegalBasis,
  ModerationMeasure,
  NotificationType,
  type ReportCategory,
  type ReportMotif,
  type ReportTargetType,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
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
 * and notifies the sanctioned user. Report takedowns queue the email in the
 * same transaction as the decision; account deletion still uses `record`.
 * The in-app bell is only for measures that leave an account behind.
 */
@Injectable()
export class ModerationDecisionService {
  private readonly logger = new Logger(ModerationDecisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  async record(input: RecordModerationDecisionInput): Promise<void> {
    await this.prisma.moderationDecision.create({
      data: this.decisionData(input),
    });

    await this.mail.sendModerationDecision(
      { email: input.subjectEmail, locale: input.subjectLocale },
      {
        measure: input.measure,
        reasonText: input.reasonText,
        legalBasis: input.legalBasis,
        tosClause: input.tosClause,
      },
    );

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

  async queueForReport(
    tx: Prisma.TransactionClient,
    input: RecordModerationDecisionInput & { reportId: string },
  ): Promise<string> {
    const decision = await tx.moderationDecision.create({
      data: this.decisionData(input),
      select: { id: true },
    });
    await tx.moderationEmailOutbox.create({
      data: { decisionId: decision.id, locale: input.subjectLocale },
    });
    await this.notifications.createInTransaction(tx, {
      userId: input.subjectUserId,
      type: NotificationType.MODERATION_ACTION,
      title: this.notificationTitle(input.measure),
      body: input.reasonText,
      url: "/app/settings",
      dedupeKey: `moderation:${input.reportId}`,
    });
    return decision.id;
  }

  publishQueued(userId: string): void {
    this.notifications.publishCreated(
      userId,
      NotificationType.MODERATION_ACTION,
    );
  }

  @Cron("*/5 * * * *")
  async dispatchPending(): Promise<void> {
    const now = new Date();
    const rows = await this.prisma.moderationEmailOutbox.findMany({
      where: {
        sentAt: null,
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { nextAttemptAt: "asc" },
      take: 25,
      select: { decisionId: true },
    });
    for (const row of rows) await this.deliver(row.decisionId);
  }

  /** Claims one pending notice so concurrent dispatchers do not send it together. */
  async deliver(decisionId: string): Promise<void> {
    const now = new Date();
    const leaseId = randomUUID();
    const { count } = await this.prisma.moderationEmailOutbox.updateMany({
      where: {
        decisionId,
        sentAt: null,
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseId,
        leaseUntil: new Date(now.getTime() + 10 * 60_000),
        attempts: { increment: 1 },
      },
    });
    if (count === 0) return;

    try {
      const row = await this.prisma.moderationEmailOutbox.findUniqueOrThrow({
        where: { decisionId },
        include: { decision: true },
      });
      await this.mail.sendModerationDecision(
        { email: row.decision.subjectEmail, locale: row.locale },
        {
          measure: row.decision.measure,
          reasonText: row.decision.reasonText,
          legalBasis: row.decision.legalBasis,
          tosClause: row.decision.tosClause,
        },
      );
      await this.prisma.moderationEmailOutbox.updateMany({
        where: { decisionId, leaseId },
        data: { sentAt: new Date(), leaseId: null, leaseUntil: null },
      });
    } catch (err) {
      this.logger.error(`Moderation email delivery failed for ${decisionId}`);
      const error = err instanceof Error ? err.message : String(err);
      const attempts = await this.prisma.moderationEmailOutbox.findUnique({
        where: { decisionId },
        select: { attempts: true },
      });
      const delayMinutes = Math.min(
        60,
        2 ** Math.min(attempts?.attempts ?? 1, 6),
      );
      await this.prisma.moderationEmailOutbox.updateMany({
        where: { decisionId, leaseId },
        data: {
          leaseId: null,
          leaseUntil: null,
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
          lastError: error.slice(0, 500),
        },
      });
    }
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
