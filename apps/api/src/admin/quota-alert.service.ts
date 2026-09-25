import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import {
  type QuotaThresholdReached,
  QuotaTrackerService,
} from "../common/quota-tracker.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

/** How each provider with a daily quota is named in its alert. */
const PROVIDER_NAMES: Record<string, string> = {
  omdb: "OMDb",
  steam: "Steam",
  simkl: "Simkl",
  smtp: "SMTP",
};

/**
 * Warns the operators when a provider reaches 80%, then 100%, of its
 * documented daily quota: an email to every admin, and an event in GlitchTip.
 * GlitchTip is also the fallback for SMTP itself — once its quota is spent,
 * the email about it can't go out.
 */
@Injectable()
export class QuotaAlertService implements OnModuleInit {
  private readonly logger = new Logger(QuotaAlertService.name);

  constructor(
    private readonly quota: QuotaTrackerService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
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

    if (event.provider === "smtp" && event.threshold >= 1) return;

    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, locale: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.mail.sendQuotaAlert(admin, {
          provider,
          count: event.count,
          limit: event.limit,
          threshold: event.threshold,
        }),
      ),
    );
  }
}
