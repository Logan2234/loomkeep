import { DigestCadence, NotificationType } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { localParts } from "../common/local-day.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { type DigestPeriod, notificationCopy } from "./notification-copy";
import { PushService } from "./push.service";

type Channel = "email" | "push";

interface DigestItem {
  title: string;
  body: string;
  url: string;
}

/** Varied so the same user doesn't read the same sentence at every send. */
function pushBody(locale: string, period: DigestPeriod, items: DigestItem[]) {
  const variants = notificationCopy(locale).episodeDigestPush(
    period,
    items.map((item) => item.title),
  );
  return variants[Math.floor(Math.random() * variants.length)];
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
      (sent) => (sent > 0 ? `${sent} digest(s) sent` : "Nothing to send"),
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
        locale: true,
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
    user: { id: string; email: string; locale: string; timezone: string },
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
      select: { id: true, title: true, body: true, url: true, dedupeKey: true },
      orderBy: { createdAt: "asc" },
    });
    if (pending.length === 0) return 0;

    // Shows the user muted are filtered here rather than at scan time: their
    // rows are still marked digested below, so an episode that aired while
    // muted never resurfaces once the user unmutes.
    const muted = await this.mutedEpisodeIds(user.id, pending);
    const deliverable = pending.filter(
      (n) => !muted.has(episodeIdOf(n.dedupeKey)),
    );

    const now = new Date();
    const markDigested = () =>
      this.prisma.notification.updateMany({
        where: { id: { in: pending.map((n) => n.id) } },
        data:
          channel === "email"
            ? { emailDigestedAt: now }
            : { pushDigestedAt: now },
      });

    if (deliverable.length === 0) {
      await markDigested();
      return 0;
    }

    const items: DigestItem[] = deliverable.map((n) => ({
      title: n.title,
      body: n.body ?? "",
      url: n.url ?? "/app/calendar",
    }));
    const period: DigestPeriod =
      effective === DigestCadence.DAILY ? "daily" : "weekly";

    if (channel === "email") {
      await this.mail.sendEpisodeDigest(
        { email: user.email, locale: user.locale },
        items,
        period,
      );
    } else {
      await this.push.sendToUser(user.id, {
        title: "Loomkeep",
        body: pushBody(user.locale, period, items),
        url: items.length === 1 ? items[0].url : "/app/calendar",
      });
    }

    await markDigested();

    return 1;
  }

  /** Episode ids, among these rows, of shows the user muted episode alerts for. */
  private async mutedEpisodeIds(
    userId: string,
    rows: { dedupeKey: string | null }[],
  ): Promise<Set<string | null>> {
    const episodes = await this.prisma.episode.findMany({
      where: {
        id: {
          in: rows
            .map((n) => episodeIdOf(n.dedupeKey))
            .filter((id): id is string => id !== null),
        },
        season: {
          mediaItem: {
            entries: { some: { userId, episodeAlertsMuted: true } },
          },
        },
      },
      select: { id: true },
    });
    return new Set(episodes.map((e) => e.id));
  }
}

/** `episode:<id>` (see `NotificationService`) back to the bare episode id. */
function episodeIdOf(dedupeKey: string | null): string | null {
  return dedupeKey?.startsWith("episode:")
    ? dedupeKey.slice("episode:".length)
    : null;
}
