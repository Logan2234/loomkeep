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
import type { NotificationCopy } from "../notifications/notification-copy";
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

export interface ModerationDecisionIdentity {
  id: string;
  decidedAt: Date;
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
    const decision = await this.prisma.moderationDecision.create({
      data: this.decisionData(input),
      select: { id: true, decidedAt: true },
    });

    await this.sendEmail(input, decision);

    if (input.measure !== ModerationMeasure.ACCOUNT_DELETED) {
      const copy = await this.notifications.copyFor(input.subjectUserId);
      await this.notifications.create({
        userId: input.subjectUserId,
        type: NotificationType.MODERATION_ACTION,
        title: this.notificationTitle(input.measure, copy),
        body: input.reasonText,
        url: "/app/settings",
      });
    }
  }

  async recordForReportInTransaction(
    tx: Prisma.TransactionClient,
    input: RecordModerationDecisionInput & { reportId: string },
  ): Promise<ModerationDecisionIdentity> {
    const [decision] = await this.recordManyForReportInTransaction(tx, [input]);
    return decision;
  }

  /**
   * Several measures taken on one report against the same person (a profile's
   * photo and bio, say): one decision row per measure, so each is counted on
   * the transparency page, but a single bell notification and — through
   * {@link sendNotice} — a single email naming them all.
   */
  async recordManyForReportInTransaction(
    tx: Prisma.TransactionClient,
    inputs: (RecordModerationDecisionInput & { reportId: string })[],
  ): Promise<ModerationDecisionIdentity[]> {
    const decisions: ModerationDecisionIdentity[] = [];

    for (const input of inputs) {
      decisions.push(
        await tx.moderationDecision.create({
          data: this.decisionData(input),
          select: { id: true, decidedAt: true },
        }),
      );
    }

    const [first] = inputs;
    const copy = await this.notifications.copyFor(first.subjectUserId);
    await this.notifications.createInTransaction(tx, {
      userId: first.subjectUserId,
      type: NotificationType.MODERATION_ACTION,
      title:
        inputs.length === 1
          ? this.notificationTitle(first.measure, copy)
          : copy.moderation.other,
      body: first.reasonText,
      url: "/app/settings",
      dedupeKey: `moderation:${first.reportId}`,
    });
    return decisions;
  }

  publishForReport(userId: string): void {
    this.notifications.publishCreated(
      userId,
      NotificationType.MODERATION_ACTION,
    );
  }

  sendEmail(
    input: RecordModerationDecisionInput,
    decision: ModerationDecisionIdentity,
  ): Promise<void> {
    return this.sendNotice([input], [decision]);
  }

  /** One email for measures recorded together; they share facts and basis. */
  sendNotice(
    inputs: RecordModerationDecisionInput[],
    decisions: ModerationDecisionIdentity[],
    suspendedUntil?: Date | null,
  ): Promise<void> {
    const [first] = inputs;
    return this.mail.sendModerationDecision(
      { email: first.subjectEmail, locale: first.subjectLocale },
      {
        measures: inputs.map((input) => input.measure),
        suspendedUntil,
        reasonText: first.reasonText,
        legalBasis: first.legalBasis,
        tosClause: first.tosClause,
        decisionIds: decisions.map((decision) => decision.id),
        decidedAt: decisions[0].decidedAt,
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

  private notificationTitle(
    measure: ModerationMeasure,
    copy: NotificationCopy,
  ): string {
    switch (measure) {
      case ModerationMeasure.COMMENT_REMOVED:
        return copy.moderation.commentRemoved;
      case ModerationMeasure.MESSAGE_REMOVED:
        return copy.moderation.messageRemoved;
      case ModerationMeasure.REVIEW_REMOVED:
        return copy.moderation.reviewRemoved;
      case ModerationMeasure.LIST_REMOVED:
        return copy.moderation.listRemoved;
      case ModerationMeasure.LIST_EDITED:
        return copy.moderation.listEdited;
      case ModerationMeasure.AVATAR_REMOVED:
      case ModerationMeasure.BIO_CLEARED:
      case ModerationMeasure.DISPLAY_NAME_CHANGED:
        return copy.moderation.profileEdited;
      case ModerationMeasure.ACCOUNT_SUSPENDED:
        return copy.moderation.suspended;
      default:
        return copy.moderation.other;
    }
  }
}
