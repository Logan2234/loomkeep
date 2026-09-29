import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { type MailRecipient, MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type { JobKey } from "./job-keys";

/**
 * Warns the operators when a scheduled job starts failing, then once it
 * succeeds again — JobRunService only calls this on a status change, so a
 * job failing every hour sends one email, not twenty-four. Best-effort: an
 * alert that can't go out must never affect the job's own outcome.
 */
@Injectable()
export class JobAlertService {
  private readonly logger = new Logger(JobAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async jobFailed(jobKey: JobKey, error: Error): Promise<void> {
    Sentry.captureException(error, { tags: { jobKey } });
    await this.emailAdmins(jobKey, (admin) =>
      this.mail.sendJobAlert(admin, {
        jobKey,
        error: error.message.split("\n")[0],
      }),
    );
  }

  async jobRecovered(jobKey: JobKey): Promise<void> {
    await this.emailAdmins(jobKey, (admin) =>
      this.mail.sendJobAlert(admin, { jobKey, error: null }),
    );
  }

  private async emailAdmins(
    jobKey: JobKey,
    send: (admin: MailRecipient) => Promise<void>,
  ): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { email: true, locale: true },
      });
      await Promise.all(admins.map(send));
    } catch (err) {
      this.logger.error(`Job alert for ${jobKey} failed`, err);
    }
  }
}
