import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { forEachIsolated } from "../jobs/for-each-isolated";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService, type JobSkipped } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { notSuspended } from "../users/suspension.util";
import { AccountDeletionService } from "./account-deletion.service";

/** Relance à 24 mois d'inactivité, suppression à 36 mois. */
const WARNING_AFTER_MONTHS = 24;
const DELETE_AFTER_MONTHS = 36;
/**
 * Minimum time between the reminder and the deletion. Without it, an account
 * already past 36 months when first warned (the first scan after enabling the
 * policy, or after an SMTP outage) was warned and deleted in the same pass.
 */
const NOTICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function monthsAgo(months: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * CNIL-driven retention policy for dormant accounts
 * (privacy-policy §11): a reminder email always precedes any automatic
 * deletion, and the warning is voided the moment the account is used again
 * (see AuthService.touchActivity, which clears inactivityWarningSentAt).
 */
@Injectable()
export class InactiveAccountService {
  private readonly logger = new Logger(InactiveAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly accountDeletion: AccountDeletionService,
    private readonly jobRuns: JobRunService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_5AM, {
    name: JOB_KEYS.INACTIVE_ACCOUNTS_SCAN,
  })
  async scan(): Promise<{ warned: number; deleted: number } | JobSkipped> {
    return this.jobRuns.record(
      JOB_KEYS.INACTIVE_ACCOUNTS_SCAN,
      () => this.runScan(),
      ({ warned, deleted }) =>
        warned === 0 && deleted === 0
          ? "Nothing to process"
          : `${warned} reminder(s) sent, ${deleted} account(s) deleted`,
    );
  }

  private async runScan(): Promise<{ warned: number; deleted: number }> {
    const warned = await this.sendWarnings();
    const deleted = await this.deleteInactiveAccounts();
    return { warned, deleted };
  }

  private async sendWarnings(): Promise<number> {
    const candidates = await this.prisma.user.findMany({
      where: {
        lastActiveAt: { lte: monthsAgo(WARNING_AFTER_MONTHS) },
        inactivityWarningSentAt: null,
        // A suspended account can't sign in to prove it's still used; the
        // warning (and so the deletion, which requires it) waits for the end.
        ...notSuspended(),
      },
      select: { id: true, email: true, locale: true, lastActiveAt: true },
    });

    const { succeeded } = await forEachIsolated(
      candidates,
      async (user) => {
        // lastActiveAt can't be null here — it's filtered by `lte` above.
        const deletionDate = new Date(
          Math.max(
            addMonths(user.lastActiveAt!, DELETE_AFTER_MONTHS).getTime(),
            Date.now() + NOTICE_DAYS * DAY_MS,
          ),
        );
        const sent = await this.mail.sendInactivityWarning(
          { email: user.email, locale: user.locale },
          deletionDate,
        );
        // Deletion requires a recorded warning: one that never reached the
        // person (no SMTP, or a failed send) must not count, so the account
        // stays until a warning actually goes out.
        if (!sent) return false;

        await this.prisma.user.update({
          where: { id: user.id },
          data: { inactivityWarningSentAt: new Date() },
        });
      },
      {
        logger: this.logger,
        label: (user) => `Inactivity warning to ${user.id}`,
      },
    );

    return succeeded;
  }

  private async deleteInactiveAccounts(): Promise<number> {
    const candidates = await this.prisma.user.findMany({
      where: {
        lastActiveAt: { lte: monthsAgo(DELETE_AFTER_MONTHS) },
        inactivityWarningSentAt: {
          lte: new Date(Date.now() - NOTICE_DAYS * DAY_MS),
        },
      },
      select: { id: true },
    });

    // A failure is retried on the next run.
    const { succeeded } = await forEachIsolated(
      candidates,
      async (user) => {
        await this.accountDeletion.deleteAccount(
          user.id,
          "inactive",
          `Suppression automatique pour inactivité (>${DELETE_AFTER_MONTHS} mois)`,
        );
        this.logger.log(`Compte ${user.id} supprimé pour inactivité`);
      },
      {
        logger: this.logger,
        label: (user) => `Inactivity deletion of ${user.id}`,
      },
    );

    return succeeded;
  }
}
