import {
  API_KEY_EXPIRY_WARNING_DAYS,
  NotificationType,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { addDays, sinceDaysAgo } from "../common/date.util";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { notificationCopy } from "../notifications/notification-copy";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { notSuspended } from "../users/suspension.util";
import { ApiKeyAuthService } from "./api-key-auth.service";

const DAY_MS = 86_400_000;
/** How far ahead of its expiration a key's owner is warned. */
/** A key nobody has used for this long is deleted. */
const UNUSED_KEY_DAYS = 365;

/**
 * The daily pass over API keys: warns before a key expires, and deletes the
 * ones nobody has used for a year — a forgotten key is pure risk.
 */
@Injectable()
export class ApiKeyLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly security: SecurityEventService,
    private readonly auth: ApiKeyAuthService,
    private readonly jobRuns: JobRunService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, {
    name: JOB_KEYS.API_KEYS_MAINTENANCE,
  })
  async runMaintenance(): Promise<{ warned: number; deleted: number }> {
    return this.jobRuns.record(
      JOB_KEYS.API_KEYS_MAINTENANCE,
      async () => ({
        warned: await this.warnExpiring(),
        deleted: await this.deleteUnused(),
      }),
      ({ warned, deleted }) =>
        warned === 0 && deleted === 0
          ? "Nothing to process"
          : `${warned} expiry warning(s) sent, ${deleted} unused key(s) deleted`,
    );
  }

  async warnExpiring(now = new Date()): Promise<number> {
    const horizon = addDays(now, API_KEY_EXPIRY_WARNING_DAYS);
    const keys = await this.prisma.apiKey.findMany({
      where: {
        expiresAt: { gt: now, lte: horizon },
        expiryNotifiedAt: null,
        user: notSuspended(now),
      },
      include: { user: { select: { email: true, locale: true } } },
    });

    let warned = 0;

    for (const { expiresAt, ...key } of keys) {
      if (!expiresAt) continue;
      // A key created for less than the warning window gets no warning: its
      // owner picked that date a few days ago.
      const lifetime = expiresAt.getTime() - key.createdAt.getTime();

      if (lifetime > API_KEY_EXPIRY_WARNING_DAYS * DAY_MS) {
        await this.mail.sendApiKeyExpiring(key.user, key.name, expiresAt);
        const copy = notificationCopy(key.user.locale).apiKeys;
        await this.notifications.create({
          userId: key.userId,
          type: NotificationType.API_KEY_EXPIRING,
          title: copy.expiringTitle,
          body: copy.expiringBody(key.name),
          url: "/app/settings/integrations",
          dedupeKey: `api-key-expiring:${key.id}`,
          data: { name: key.name, expiresAt: expiresAt.toISOString() },
        });
        warned++;
      }

      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { expiryNotifiedAt: now },
      });
    }

    return warned;
  }

  async deleteUnused(now = new Date()): Promise<number> {
    const cutoff = sinceDaysAgo(now, UNUSED_KEY_DAYS);
    const keys = await this.prisma.apiKey.findMany({
      where: {
        OR: [
          { lastUsedAt: { lt: cutoff } },
          { lastUsedAt: null, createdAt: { lt: cutoff } },
        ],
      },
      select: { id: true, userId: true, name: true },
    });

    for (const key of keys) {
      await this.prisma.apiKey.deleteMany({ where: { id: key.id } });
      this.auth.invalidate(key.id);
      await this.security.record({
        type: "API_KEY_REVOKED",
        userId: key.userId,
        detail: key.name,
      });
    }

    return keys.length;
  }
}
