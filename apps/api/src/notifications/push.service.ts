import { Injectable, Logger } from "@nestjs/common";
import webpush from "web-push";
import { PrismaService } from "../prisma/prisma.service";

export interface PushPayload {
  title: string;
  body: string;
  /** Path to open in the app when the notification is clicked (e.g. "/app/media/…"). */
  url: string;
}

export interface PushDevice {
  id: string;
  userAgent: string | null;
  createdAt: Date;
}

export interface PushSendOutcome {
  userAgent: string | null;
  ok: boolean;
  /** Present when `ok` is false — the HTTP status if the push service rejected it, or the error message. */
  error?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    this.enabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

    if (this.enabled) {
      webpush.setVapidDetails(
        VAPID_SUBJECT ?? "mailto:loganwi322.dev@gmail.com",
        VAPID_PUBLIC_KEY!,
        VAPID_PRIVATE_KEY!,
      );
    } else {
      // Self-host without HTTPS/VAPID configured: push is a no-op, in-app stays available.
      this.logger.warn("VAPID keys not set — push notifications are disabled");
    }
  }

  publicKey(): string {
    return this.enabled ? process.env.VAPID_PUBLIC_KEY! : "";
  }

  async subscribe(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth, userAgent },
      create: { userId, endpoint, p256dh, auth, userAgent },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  /** Every device the user has a live subscription on, most recent first. */
  async listSubscriptions(userId: string): Promise<PushDevice[]> {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, createdAt: true },
    });
  }

  /** Sends to every device the user has subscribed on; prunes dead subscriptions. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    await this.sendToUserDetailed(userId, payload);
  }

  /** Same as {@link sendToUser}, but reports the per-device outcome instead of swallowing it. */
  async sendToUserDetailed(
    userId: string,
    payload: PushPayload,
  ): Promise<PushSendOutcome[]> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (!this.enabled || subscriptions.length === 0) return [];

    return Promise.all(
      subscriptions.map(async (sub): Promise<PushSendOutcome> => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
          return { userAgent: sub.userAgent, ok: true };
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;

          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired or was revoked by the browser — stop trying it.
            await this.prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          } else {
            this.logger.error(`Push failed for subscription ${sub.id}`, err);
          }

          return {
            userAgent: sub.userAgent,
            ok: false,
            error: statusCode ? `HTTP ${statusCode}` : String(err),
          };
        }
      }),
    );
  }
}
