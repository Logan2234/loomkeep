import { AlertGroup, type AlertKey, isAlertEnabled } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import type { MailRecipient } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { readAlertPrefs } from "./alert-prefs.util";
import { type NotificationCopy, notificationCopy } from "./notification-copy";
import { type PushPayload, PushService } from "./push.service";

export type AdminAlertKey = Extract<
  AlertKey,
  | "ADMIN_REPORTS_PENDING"
  | "ADMIN_JOB_FAILED"
  | "ADMIN_IMPORT_FAILED"
  | "ADMIN_QUOTA"
  | "ADMIN_NEW_USER"
  | "ADMIN_UPDATE_AVAILABLE"
>;

/**
 * Sends an operator alert to every administrator, on the channels each one
 * kept: email on and push off unless they changed it in their settings.
 * Returns how many administrators there are.
 */
@Injectable()
export class AdminAlertService {
  private readonly logger = new Logger(AdminAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async notify(
    key: AdminAlertKey,
    send: {
      email: (admin: MailRecipient) => Promise<unknown>;
      push: (copy: NotificationCopy) => Omit<PushPayload, "group">;
    },
  ): Promise<number> {
    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true, locale: true, alertPrefs: true },
    });

    await Promise.all(
      admins.map(async (admin) => {
        const prefs = readAlertPrefs(admin.alertPrefs);

        // Each admin and each channel fails on its own: a failed email used
        // to skip that admin's push and reject the whole alert.
        if (isAlertEnabled(prefs, key, "email")) {
          try {
            await send.email({ email: admin.email, locale: admin.locale });
          } catch (err) {
            this.logger.error(`${key} email failed for ${admin.id}`, err);
          }
        }

        if (isAlertEnabled(prefs, key, "push")) {
          try {
            await this.push.sendToUser(admin.id, {
              ...send.push(notificationCopy(admin.locale)),
              group: AlertGroup.ADMIN,
            });
          } catch (err) {
            this.logger.error(`${key} push failed for ${admin.id}`, err);
          }
        }
      }),
    );

    return admins.length;
  }
}
