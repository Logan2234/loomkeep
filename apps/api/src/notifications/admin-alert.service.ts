import {
  type AlertKey,
  type AlertPrefs,
  isAlertEnabled,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type { MailRecipient } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { type NotificationCopy, notificationCopy } from "./notification-copy";
import { type PushPayload, PushService } from "./push.service";

export type AdminAlertKey = Extract<
  AlertKey,
  | "ADMIN_REPORTS_PENDING"
  | "ADMIN_JOB_FAILED"
  | "ADMIN_QUOTA"
  | "ADMIN_NEW_USER"
>;

/**
 * Sends an operator alert to every administrator, on the channels each one
 * kept: email on and push off unless they changed it in their settings.
 * Returns how many administrators there are.
 */
@Injectable()
export class AdminAlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async notify(
    key: AdminAlertKey,
    send: {
      email: (admin: MailRecipient) => Promise<unknown>;
      push: (copy: NotificationCopy) => PushPayload;
    },
  ): Promise<number> {
    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true, locale: true, alertPrefs: true },
    });

    await Promise.all(
      admins.map(async (admin) => {
        const prefs = admin.alertPrefs as AlertPrefs;

        if (isAlertEnabled(prefs, key, "email")) {
          await send.email({ email: admin.email, locale: admin.locale });
        }

        if (isAlertEnabled(prefs, key, "push")) {
          await this.push.sendToUser(
            admin.id,
            send.push(notificationCopy(admin.locale)),
          );
        }
      }),
    );

    return admins.length;
  }
}
