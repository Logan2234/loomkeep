import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminAlertService } from "./admin-alert.service";
import type { PushService } from "./push.service";

function make(admins: object[]) {
  const prisma = {
    user: { findMany: vi.fn().mockResolvedValue(admins) },
  } as unknown as PrismaService;
  const push = { sendToUser: vi.fn() } as unknown as PushService;
  return { service: new AdminAlertService(prisma, push), push };
}

describe("AdminAlertService", () => {
  const send = () => ({
    email: vi.fn(),
    push: vi.fn(() => ({ title: "t", body: "b", url: "/app/admin" })),
  });

  it("emails by default and pushes only those who asked for it", async () => {
    const { service, push } = make([
      { id: "a1", email: "a@x.com", locale: "fr", alertPrefs: {} },
      {
        id: "a2",
        email: "b@x.com",
        locale: "en",
        alertPrefs: { ADMIN_JOB_FAILED: { email: false, push: true } },
      },
    ]);
    const channels = send();

    await expect(service.notify("ADMIN_JOB_FAILED", channels)).resolves.toBe(2);

    expect(channels.email).toHaveBeenCalledTimes(1);
    expect(channels.email).toHaveBeenCalledWith({
      email: "a@x.com",
      locale: "fr",
    });
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledWith("a2", expect.anything());
  });
});
