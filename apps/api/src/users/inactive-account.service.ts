import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { AccountDeletionService } from "./account-deletion.service";

/** LK-C06: relance à 24 mois d'inactivité, suppression à 36 mois. */
const WARNING_AFTER_MONTHS = 24;
const DELETE_AFTER_MONTHS = 36;

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
 * CNIL-driven retention policy for dormant accounts (LK-C06,
 * privacy-policy §11): a reminder email always precedes any automatic
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

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async scan(): Promise<{ warned: number; deleted: number }> {
    return this.jobRuns.record(
      JOB_KEYS.INACTIVE_ACCOUNTS_SCAN,
      () => this.runScan(),
      ({ warned, deleted }) =>
        warned === 0 && deleted === 0
          ? "Rien à traiter"
          : `${warned} relance(s) envoyée(s), ${deleted} compte(s) supprimé(s)`,
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
      },
      select: { id: true, email: true, lastActiveAt: true },
    });

    for (const user of candidates) {
      // lastActiveAt can't be null here — it's filtered by `lte` above.
      const deletionDate = addMonths(user.lastActiveAt!, DELETE_AFTER_MONTHS);
      await this.mail.sendInactivityWarning(
        user.email,
        deletionDate.toLocaleDateString("fr-FR"),
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { inactivityWarningSentAt: new Date() },
      });
    }

    return candidates.length;
  }

  private async deleteInactiveAccounts(): Promise<number> {
    const candidates = await this.prisma.user.findMany({
      where: {
        lastActiveAt: { lte: monthsAgo(DELETE_AFTER_MONTHS) },
        inactivityWarningSentAt: { not: null },
      },
      select: { id: true },
    });

    for (const user of candidates) {
      await this.accountDeletion.deleteAccount(
        user.id,
        `Suppression automatique pour inactivité (>${DELETE_AFTER_MONTHS} mois, LK-C06)`,
      );
      this.logger.log(`Compte ${user.id} supprimé pour inactivité`);
    }

    return candidates.length;
  }
}
