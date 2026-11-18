import { vi } from "vitest";
import type { MailService } from "../mail/mail.service";
import { AdminAlertService } from "../notifications/admin-alert.service";
import type { PushService } from "../notifications/push.service";
import type { PrismaService } from "../prisma/prisma.service";
import { ImportAlertService } from "./import-alert.service";

function make() {
  const prisma = {
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "a", email: "a@example.test", locale: "fr", alertPrefs: null },
        ]),
    },
  };
  const mail = { sendImportAlert: vi.fn().mockResolvedValue(undefined) };
  const service = new ImportAlertService(
    mail as unknown as MailService,
    new AdminAlertService(
      prisma as unknown as PrismaService,
      { sendToUser: vi.fn() } as unknown as PushService,
    ),
  );
  return { service, prisma, mail };
}

describe("ImportAlertService", () => {
  it("emails every admin the source and the error's first line", async () => {
    const { service, mail } = make();

    await service.importFailed("letterboxd", "TMDB down\n    at fetch()");

    expect(mail.sendImportAlert).toHaveBeenCalledWith(
      { email: "a@example.test", locale: "fr" },
      { source: "Letterboxd", error: "TMDB down" },
    );
  });

  it("never throws when the alert can't go out", async () => {
    const { service, prisma } = make();
    prisma.user.findMany.mockRejectedValue(new Error("db down"));

    await expect(
      service.importFailed("letterboxd", "boom"),
    ).resolves.toBeUndefined();
  });
});
