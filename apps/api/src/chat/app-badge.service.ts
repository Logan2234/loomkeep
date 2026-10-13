import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationService } from "../notifications/notification.service";
import { PushService } from "../notifications/push.service";
import { PrismaService } from "../prisma/prisma.service";
import { isChatEnabled } from "./chat.config";
import { ChatService } from "./chat.service";

/**
 * The installed app's icon badge: what the bell's badge counts (new entries
 * and pending follow requests) plus unread messages. Lives here rather than
 * in NotificationModule, which chat depends on.
 */
@Injectable()
export class AppBadgeService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly chat: ChatService,
    private readonly push: PushService,
  ) {}

  onModuleInit(): void {
    this.push.setBadgeSource((userId) => this.count(userId));
  }

  async count(userId: string): Promise<number> {
    const [{ unseen }, requests, messages] = await Promise.all([
      this.notifications.counts(userId),
      this.prisma.follow.count({
        where: { followeeId: userId, status: "PENDING" },
      }),
      isChatEnabled(this.config) ? this.chat.unreadTotal(userId) : 0,
    ]);
    return unseen + requests + messages;
  }
}
