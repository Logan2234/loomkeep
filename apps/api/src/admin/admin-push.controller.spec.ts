import { vi, type Mock } from "vitest";
import { AppException } from "../common/app.exception";
import type { PushService } from "../notifications/push.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminPushController } from "./admin-push.controller";

function makeController() {
  const push = {
    listSubscriptions: vi.fn().mockResolvedValue([]),
    sendToUserDetailed: vi.fn().mockResolvedValue([]),
  } as unknown as PushService;
  const prisma = {
    user: { findUnique: vi.fn() },
    pushSubscription: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  const controller = new AdminPushController(push, prisma);
  return { controller, push, prisma };
}

describe("AdminPushController.sendAdminTestPush", () => {
  it("throws NotFoundException when no account matches the email", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.user.findUnique as Mock).mockResolvedValue(null);

    await expect(
      controller.sendAdminTestPush({ email: "nobody@example.com" }),
    ).rejects.toThrow(AppException);
    expect(push.sendToUserDetailed).not.toHaveBeenCalled();
  });

  it("sends to the matching account's devices", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.user.findUnique as Mock).mockResolvedValue({ id: "user-1" });

    await controller.sendAdminTestPush({ email: "alice@example.com" });

    expect(push.sendToUserDetailed).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: expect.any(String),
        url: "/app",
      }),
    );
  });

  it("uses the recipient's language for the default test message", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.user.findUnique as Mock).mockResolvedValue({
      id: "user-1",
      locale: "en",
    });

    await controller.sendAdminTestPush({ email: "alice@example.com" });

    expect(push.sendToUserDetailed).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        body: "This is a test notification sent from the admin panel.",
      }),
    );
  });
});

describe("AdminPushController.broadcastAdminPush", () => {
  it("sends to every distinct subscribed account and aggregates the outcome", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.pushSubscription.findMany as Mock).mockResolvedValue([
      { userId: "user-1", user: { locale: "fr" } },
      { userId: "user-2", user: { locale: "en" } },
    ]);
    (push.sendToUserDetailed as Mock)
      .mockResolvedValueOnce([{ userAgent: "a", ok: true }])
      .mockResolvedValueOnce([
        { userAgent: "b", ok: true },
        { userAgent: "c", ok: false, error: "HTTP 410" },
      ]);

    const result = await controller.broadcastAdminPush({});

    expect(push.sendToUserDetailed).toHaveBeenCalledTimes(2);
    expect(push.sendToUserDetailed).toHaveBeenNthCalledWith(
      1,
      "user-1",
      expect.objectContaining({
        url: "/app",
        body: "Message envoyé à tous les comptes depuis le panel admin.",
      }),
    );
    expect(push.sendToUserDetailed).toHaveBeenNthCalledWith(
      2,
      "user-2",
      expect.objectContaining({
        url: "/app",
        body: "Message sent to all accounts from the admin panel.",
      }),
    );
    expect(result).toEqual({
      accountCount: 2,
      deviceCount: 3,
      successCount: 2,
      failureCount: 1,
    });
  });

  it("keeps custom broadcast copy unchanged for every recipient", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.pushSubscription.findMany as Mock).mockResolvedValue([
      { userId: "user-1", user: { locale: "fr" } },
      { userId: "user-2", user: { locale: "en" } },
    ]);

    await controller.broadcastAdminPush({ title: "Custom", body: "Same text" });

    expect(push.sendToUserDetailed).toHaveBeenCalledTimes(2);

    for (const [, payload] of (push.sendToUserDetailed as Mock).mock.calls) {
      expect(payload).toEqual(
        expect.objectContaining({ title: "Custom", body: "Same text" }),
      );
    }
  });
});
