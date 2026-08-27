import { AppException } from "../common/app.exception";
import type { PushService } from "../notifications/push.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminPushController } from "./admin-push.controller";

function makeController() {
  const push = {
    listSubscriptions: jest.fn().mockResolvedValue([]),
    sendToUserDetailed: jest.fn().mockResolvedValue([]),
  } as unknown as PushService;
  const prisma = {
    user: { findUnique: jest.fn() },
    pushSubscription: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  const controller = new AdminPushController(push, prisma);
  return { controller, push, prisma };
}

describe("AdminPushController.sendAdminTestPush", () => {
  it("throws NotFoundException when no account matches the email", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.sendAdminTestPush({ email: "nobody@example.com" }),
    ).rejects.toThrow(AppException);
    expect(push.sendToUserDetailed).not.toHaveBeenCalled();
  });

  it("sends to the matching account's devices", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });

    await controller.sendAdminTestPush({ email: "alice@example.com" });

    expect(push.sendToUserDetailed).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: expect.any(String) }),
    );
  });
});

describe("AdminPushController.broadcastAdminPush", () => {
  it("sends to every distinct subscribed account and aggregates the outcome", async () => {
    const { controller, prisma, push } = makeController();
    (prisma.pushSubscription.findMany as jest.Mock).mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    (push.sendToUserDetailed as jest.Mock)
      .mockResolvedValueOnce([{ userAgent: "a", ok: true }])
      .mockResolvedValueOnce([
        { userAgent: "b", ok: true },
        { userAgent: "c", ok: false, error: "HTTP 410" },
      ]);

    const result = await controller.broadcastAdminPush({});

    expect(push.sendToUserDetailed).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      accountCount: 2,
      deviceCount: 3,
      successCount: 2,
      failureCount: 1,
    });
  });
});
