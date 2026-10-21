import {
  ACCOUNT_DELETION_GRACE_DAYS,
  type AccountDeletionReason,
  type AccountDeletionScheduleDto,
  ErrorCode,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AppException } from "../common/app.exception";
import { randomToken, sha256Hex } from "../common/crypto.util";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { AccountDeletionService } from "./account-deletion.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Self-requested deletion, deferred by ACCOUNT_DELETION_GRACE_DAYS so a
 * mistake, a stolen session or a change of heart can be undone. Nothing
 * else changes meanwhile: the account keeps working, and the person cancels
 * from the app, from the emailed link, or through an administrator.
 */
@Injectable()
export class ScheduledDeletionService {
  private readonly logger = new Logger(ScheduledDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly accountDeletion: AccountDeletionService,
    private readonly jobRuns: JobRunService,
  ) {}

  /** Asking twice keeps the first date, so the deadline can't be pushed back unnoticed. */
  async schedule(
    userId: string,
    reason?: AccountDeletionReason,
  ): Promise<AccountDeletionScheduleDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, locale: true, deletionScheduledFor: true },
    });

    if (!user) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);
    }

    if (user.deletionScheduledFor) {
      return { scheduledFor: user.deletionScheduledFor.toISOString() };
    }

    const scheduledFor = new Date(
      Date.now() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS,
    );
    const token = randomToken(32, "hex");
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletionScheduledFor: scheduledFor,
        deletionReason: reason ?? null,
        deletionCancelTokenHash: sha256Hex(token),
      },
    });
    await this.mail.sendAccountDeletionScheduled(
      { email: user.email, locale: user.locale },
      scheduledFor,
      token,
    );

    return { scheduledFor: scheduledFor.toISOString() };
  }

  async cancel(userId: string): Promise<void> {
    await this.clear({ id: userId });
  }

  /** The emailed link: works signed out, once. */
  async cancelWithToken(token: string): Promise<void> {
    const { count } = await this.prisma.user.updateMany({
      where: {
        deletionCancelTokenHash: sha256Hex(token),
        deletionScheduledFor: { not: null },
      },
      data: cleared(),
    });

    if (count === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserDeletionCancelLinkInvalid,
      );
    }
  }

  /** On the person's request to support: they're told by email, since they didn't do it. */
  async cancelByAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, locale: true, deletionScheduledFor: true },
    });

    if (!user) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);
    }

    if (!user.deletionScheduledFor) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.UserDeletionNotScheduled,
      );
    }

    await this.clear({ id: userId });
    await this.mail.sendAccountDeletionCancelled({
      email: user.email,
      locale: user.locale,
    });
  }

  // 5:15, right after the inactive-accounts scan: once a day is enough for a
  // date announced to the day, and a missed run only delays by a day.
  @Cron("15 5 * * *", { name: JOB_KEYS.SCHEDULED_DELETIONS })
  async scan(): Promise<{ reminded: number; deleted: number }> {
    return this.jobRuns.record(
      JOB_KEYS.SCHEDULED_DELETIONS,
      () => this.runScan(),
      ({ reminded, deleted }) =>
        reminded === 0 && deleted === 0
          ? "Nothing to process"
          : `${reminded} reminder(s) sent, ${deleted} account(s) deleted`,
    );
  }

  private async runScan(): Promise<{ reminded: number; deleted: number }> {
    const now = Date.now();
    // The daily run catches each account in exactly one 24-hour window, so
    // the reminder goes once without keeping a "sent" flag.
    const toRemind = await this.prisma.user.findMany({
      where: {
        deletionScheduledFor: {
          gt: new Date(now + 24 * HOUR_MS),
          lte: new Date(now + 48 * HOUR_MS),
        },
      },
      select: { email: true, locale: true, deletionScheduledFor: true },
    });

    for (const user of toRemind) {
      await this.mail.sendAccountDeletionReminder(
        { email: user.email, locale: user.locale },
        user.deletionScheduledFor!,
      );
    }

    const due = await this.prisma.user.findMany({
      where: { deletionScheduledFor: { lte: new Date(now) } },
      select: { id: true },
    });

    for (const user of due) {
      await this.accountDeletion.deleteAccount(
        user.id,
        "self",
        "Suppression demandée par l'utilisateur",
      );
      this.logger.log(`Compte ${user.id} supprimé à sa demande`);
    }

    return { reminded: toRemind.length, deleted: due.length };
  }

  private async clear(where: { id: string }): Promise<void> {
    await this.prisma.user.updateMany({ where, data: cleared() });
  }
}

function cleared() {
  return {
    deletionScheduledFor: null,
    deletionReason: null,
    deletionCancelTokenHash: null,
  };
}
