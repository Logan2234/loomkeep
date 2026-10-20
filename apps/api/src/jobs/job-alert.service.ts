import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { MailService } from "../mail/mail.service";
import { AdminAlertService } from "../notifications/admin-alert.service";
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
    private readonly mail: MailService,
    private readonly adminAlerts: AdminAlertService,
  ) {}

  async jobFailed(jobKey: JobKey, error: Error): Promise<void> {
    Sentry.captureException(error, { tags: { jobKey } });
    await this.alertAdmins(jobKey, {
      email: (admin) =>
        this.mail.sendJobAlert(admin, {
          jobKey,
          error: error.message.split("\n")[0],
        }),
      push: (copy) => ({
        ...copy.adminAlerts.jobFailed(jobKey),
        url: "/app/admin/jobs",
      }),
    });
  }

  async jobRecovered(jobKey: JobKey): Promise<void> {
    await this.alertAdmins(jobKey, {
      email: (admin) => this.mail.sendJobAlert(admin, { jobKey, error: null }),
      push: (copy) => ({
        ...copy.adminAlerts.jobRecovered(jobKey),
        url: "/app/admin/jobs",
      }),
    });
  }

  private async alertAdmins(
    jobKey: JobKey,
    send: Parameters<AdminAlertService["notify"]>[1],
  ): Promise<void> {
    try {
      await this.adminAlerts.notify("ADMIN_JOB_FAILED", send);
    } catch (err) {
      this.logger.error(`Job alert for ${jobKey} failed`, err);
    }
  }
}
