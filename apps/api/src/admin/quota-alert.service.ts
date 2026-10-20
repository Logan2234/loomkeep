import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import {
  type QuotaThresholdReached,
  QuotaTrackerService,
} from "../common/quota-tracker.service";
import { MailService } from "../mail/mail.service";
import { AdminAlertService } from "../notifications/admin-alert.service";

/** How each provider with a daily quota is named in its alert. */
const PROVIDER_NAMES: Record<string, string> = {
  omdb: "OMDb",
  steam: "Steam",
  simkl: "Simkl",
  smtp: "SMTP",
};

/**
 * Warns the operators when a provider reaches 80%, then 100%, of its
 * documented daily quota: an email (or a push, per each admin's settings) to
 * every admin, and an event in GlitchTip. Push and GlitchTip are the fallback
 * for SMTP itself — once its quota is spent, the email about it can't go out.
 */
@Injectable()
export class QuotaAlertService implements OnModuleInit {
  private readonly logger = new Logger(QuotaAlertService.name);

  constructor(
    private readonly quota: QuotaTrackerService,
    private readonly mail: MailService,
    private readonly adminAlerts: AdminAlertService,
  ) {}

  onModuleInit(): void {
    this.quota.onThresholdReached((event) => {
      this.alert(event).catch((err: unknown) =>
        this.logger.error(`Quota alert for ${event.provider} failed`, err),
      );
    });
  }

  async alert(event: QuotaThresholdReached): Promise<void> {
    const provider = PROVIDER_NAMES[event.provider] ?? event.provider;
    const percent = Math.round(event.threshold * 100);
    const summary = `Provider quota: ${provider} at ${percent}% (${event.count}/${event.limit} today)`;

    this.logger.warn(summary);
    Sentry.captureMessage(summary, {
      level: event.threshold >= 1 ? "error" : "warning",
      tags: { provider: event.provider, quotaThreshold: String(percent) },
    });

    const smtpSpent = event.provider === "smtp" && event.threshold >= 1;

    await this.adminAlerts.notify("ADMIN_QUOTA", {
      email: async (admin) => {
        if (smtpSpent) return;
        await this.mail.sendQuotaAlert(admin, {
          provider,
          count: event.count,
          limit: event.limit,
          threshold: event.threshold,
        });
      },
      push: (copy) => ({
        ...copy.adminAlerts.quota(provider, percent),
        url: "/app/admin/services",
      }),
    });
  }
}
