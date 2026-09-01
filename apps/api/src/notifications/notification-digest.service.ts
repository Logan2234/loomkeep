import { DigestCadence, NotificationType } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { localParts } from "../common/local-day.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { PushService } from "./push.service";

type Channel = "email" | "push";
type Period = "daily" | "weekly";

interface DigestItem {
  title: string;
  body: string;
  url: string;
}

/**
 * DRAFT WORDING — needs Logan's sign-off before any real send goes out (see
 * the notification-digest feature plan). One random pick per send so the
 * same user doesn't see the exact same sentence every day.
 */
const PUSH_VARIANTS: Record<
  "one" | "two" | "many",
  ((period: Period, items: DigestItem[]) => string)[]
> = {
  one: [
    (period, items) => `${items[0].title} sort ${periodLabel(period)} !`,
    (period, items) =>
      `Ça y est, ${items[0].title} est de retour ${periodLabel(period)}.`,
  ],
  two: [
    (period, items) =>
      `${items[0].title} et ${items[1].title} sortent ${periodLabel(period)}`,
    (period, items) =>
      `Double sortie ${periodLabel(period)} : ${items[0].title} et ${items[1].title}`,
  ],
  many: [
    (period, items) =>
      `${items.length} sorties t'attendent ${periodLabel(period)}`,
    (period, items) =>
      `${items[0].title}, ${items[1].title} et ${items.length - 2} autre(s) sortent ${periodLabel(period)}`,
  ],
};

function periodLabel(period: Period): string {
  return period === "daily" ? "aujourd'hui" : "cette semaine";
}

function pushBody(period: Period, items: DigestItem[]): string {
  const tier = items.length === 1 ? "one" : items.length === 2 ? "two" : "many";
  const variants = PUSH_VARIANTS[tier];
  return variants[Math.floor(Math.random() * variants.length)](period, items);
}

/**
 * Delivers the "new episode" digest at each user's local hour, cadenced
 * independently per channel (email/push). Content is whatever `NEW_EPISODE`
 * ledger rows (created by `NotificationService.scan()`) haven't been
 * digested yet on that channel — no date-window recomputation needed, just
 * `[channel]DigestedAt IS NULL`.
 */
@Injectable()
export class NotificationDigestService {
  private readonly logger = new Logger(NotificationDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly entitlements: EntitlementService,
    private readonly jobRuns: JobRunService,
  ) {}

  /**
   * Hourly: for each user, checks whether it's currently their local digest
   * hour on each channel (18h daily, Monday 9h weekly) and sends if so.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runDigests(): Promise<number> {
    return this.jobRuns.record(
      JOB_KEYS.NOTIFICATIONS_DIGEST,
      () => this.run(),
      (sent) => (sent > 0 ? `${sent} digest(s) envoyé(s)` : "Rien à envoyer"),
    );
  }

  private async run(): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { notifyEmail: { not: DigestCadence.DISABLED } },
          { notifyPush: { not: DigestCadence.DISABLED } },
        ],
      },
      select: {
        id: true,
        email: true,
        notifyEmail: true,
        notifyPush: true,
        timezone: true,
      },
    });

    let sent = 0;

    for (const user of users) {
      try {
        sent += await this.deliverChannel(user, "email", user.notifyEmail);
        sent += await this.deliverChannel(user, "push", user.notifyPush);
      } catch (err) {
        // One user's failure must not abort the batch.
        this.logger.error(`Digest failed for user ${user.id}`, err);
      }
    }

    return sent;
  }

  /**
   * `DAILY` requires effective premium — a downgraded/never-premium account
   * is served at `WEEKLY` instead, so their pending items are never silently
   * dropped, just delivered less often (re-checked every run, like the ICS
   * calendar token).
   */
  async resolveEffectiveCadence(
    stored: DigestCadence,
    userId: string,
  ): Promise<DigestCadence> {
    if (stored !== DigestCadence.DAILY) return stored;
    return (await this.entitlements.isEffectivelyPremium(userId))
      ? DigestCadence.DAILY
      : DigestCadence.WEEKLY;
  }

  /** Returns 1 if a digest was sent on this channel, 0 otherwise. */
  private async deliverChannel(
    user: { id: string; email: string; timezone: string },
    channel: Channel,
    stored: DigestCadence,
  ): Promise<number> {
    if (stored === DigestCadence.DISABLED) return 0;

    const effective = await this.resolveEffectiveCadence(stored, user.id);
    const local = localParts(user.timezone, new Date());
    if (!local) return 0;

    const due =
      (effective === DigestCadence.DAILY && local.hour === 18) ||
      (effective === DigestCadence.WEEKLY &&
        local.weekday === "Mon" &&
        local.hour === 9);
    if (!due) return 0;

    const pending = await this.prisma.notification.findMany({
      where: {
        userId: user.id,
        type: NotificationType.NEW_EPISODE,
        ...(channel === "email"
          ? { emailDigestedAt: null }
          : { pushDigestedAt: null }),
      },
      select: { id: true, title: true, body: true, url: true },
      orderBy: { createdAt: "asc" },
    });
    if (pending.length === 0) return 0;

    const items: DigestItem[] = pending.map((n) => ({
      title: n.title,
      body: n.body ?? "",
      url: n.url ?? "/app/calendar",
    }));
    const period: Period =
      effective === DigestCadence.DAILY ? "daily" : "weekly";

    if (channel === "email") {
      await this.mail.sendEpisodeDigest(user.email, items, period);
    } else {
      await this.push.sendToUser(user.id, {
        title: "Loomkeep",
        body: pushBody(period, items),
        url: items.length === 1 ? items[0].url : "/app/calendar",
      });
    }

    const now = new Date();
    await this.prisma.notification.updateMany({
      where: { id: { in: pending.map((n) => n.id) } },
      data:
        channel === "email"
          ? { emailDigestedAt: now }
          : { pushDigestedAt: now },
    });

    return 1;
  }
}
