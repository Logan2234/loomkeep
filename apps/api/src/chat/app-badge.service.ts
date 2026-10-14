import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationService } from "../notifications/notification.service";
import { PushService } from "../notifications/push.service";
import { PrismaService } from "../prisma/prisma.service";
import { isChatEnabled } from "./chat.config";
import { ChatService } from "./chat.service";
import { WorkThreadService } from "./work-thread.service";

/**
 * The installed app's icon badge: what the bell's badge counts (new entries
 * and pending follow requests) plus what the Messages tab counts (unread
 * messages and works' discussions). Lives here rather than
 * in NotificationModule, which chat depends on.
 */
@Injectable()
export class AppBadgeService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly chat: ChatService,
    private readonly threads: WorkThreadService,
    private readonly push: PushService,
  ) {}

  onModuleInit(): void {
    this.push.setBadgeSource((userId) => this.count(userId));
  }

  async count(userId: string): Promise<number> {
    const chatOn = isChatEnabled(this.config);
    const [{ unseen }, requests, messages, discussions] = await Promise.all([
      this.notifications.counts(userId),
      this.prisma.follow.count({
        where: { followeeId: userId, status: "PENDING" },
      }),
      chatOn ? this.chat.unreadTotal(userId) : 0,
      chatOn ? this.threads.unreadTotal(userId) : 0,
    ]);
    return unseen + requests + messages + discussions;
  }
}
