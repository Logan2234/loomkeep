import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { NotificationService } from "../notifications/notification.service";
import type { PushService } from "../notifications/push.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AppBadgeService } from "./app-badge.service";
import type { ChatService } from "./chat.service";

function makeService(chatEnabled: boolean) {
  const prisma = {
    follow: { count: vi.fn().mockResolvedValue(1) },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) =>
      key === "SOCIAL_ENABLED" || key === "CHAT_ENABLED"
        ? String(chatEnabled)
        : undefined,
  } as unknown as ConfigService;
  const notifications = {
    counts: vi.fn().mockResolvedValue({ unread: 5, unseen: 2 }),
  } as unknown as NotificationService;
  const chat = {
    unreadTotal: vi.fn().mockResolvedValue(3),
  } as unknown as ChatService;
  const push = { setBadgeSource: vi.fn() } as unknown as PushService;
  return {
    service: new AppBadgeService(prisma, config, notifications, chat, push),
    prisma,
    push,
  };
}

describe("AppBadgeService", () => {
  it("adds up the bell's badge and the unread messages", async () => {
    const { service, prisma } = makeService(true);

    // 2 new entries + 1 pending follow request + 3 messages.
    expect(await service.count("u1")).toBe(6);
    expect(prisma.follow.count).toHaveBeenCalledWith({
      where: { followeeId: "u1", status: "PENDING" },
    });
  });

  it("leaves messages out on an instance without chat", async () => {
    const { service } = makeService(false);

    expect(await service.count("u1")).toBe(3);
  });

  it("hands its count to every push once the app starts", async () => {
    const { service, push } = makeService(true);

    service.onModuleInit();

    expect(push.setBadgeSource).toHaveBeenCalledWith(expect.any(Function));
  });
});
