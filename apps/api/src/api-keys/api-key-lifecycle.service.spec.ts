import { vi } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { ApiKeyAuthService } from "./api-key-auth.service";
import { ApiKeyLifecycleService } from "./api-key-lifecycle.service";

const NOW = new Date("2026-10-01T06:00:00Z");
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 86_400_000);
const USER = { email: "alice@example.com", locale: "fr" };

function setup(rows: object[]) {
  const prisma = {
    apiKey: {
      findMany: vi.fn().mockResolvedValue(rows),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const mail = { sendApiKeyExpiring: vi.fn() };
  const security = { record: vi.fn() };
  const auth = { invalidate: vi.fn() };
  const notifications = { create: vi.fn() };
  const service = new ApiKeyLifecycleService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    security as unknown as SecurityEventService,
    auth as unknown as ApiKeyAuthService,
    {} as JobRunService,
    notifications as unknown as NotificationService,
  );
  return { service, prisma, mail, security, auth, notifications };
}

describe("ApiKeyLifecycleService", () => {
  describe("warnExpiring", () => {
    it("emails once a week before expiry, and marks the key so it isn't emailed twice", async () => {
      const { service, prisma, mail } = setup([
        {
          id: "key-1",
          name: "Script perso",
          expiresAt: daysFromNow(6),
          createdAt: daysFromNow(-84),
          user: USER,
        },
      ]);

      await expect(service.warnExpiring(NOW)).resolves.toBe(1);

      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            expiresAt: { gt: NOW, lte: daysFromNow(7) },
            expiryNotifiedAt: null,
          },
        }),
      );
      expect(mail.sendApiKeyExpiring).toHaveBeenCalledWith(
        USER,
        "Script perso",
        daysFromNow(6),
      );
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key-1" },
        data: { expiryNotifiedAt: NOW },
      });
    });

    it("puts the warning in the bell too, next to the other key alerts", async () => {
      const { service, notifications } = setup([
        {
          id: "key-1",
          userId: "u1",
          name: "Script perso",
          expiresAt: daysFromNow(6),
          createdAt: daysFromNow(-84),
          user: USER,
        },
      ]);

      await service.warnExpiring(NOW);

      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          type: "API_KEY_EXPIRING",
          title: "Clé API bientôt expirée",
          dedupeKey: "api-key-expiring:key-1",
        }),
      );
    });

    it("stays quiet about a key created for less than a week", async () => {
      const { service, prisma, mail } = setup([
        {
          id: "key-1",
          name: "Test",
          expiresAt: daysFromNow(3),
          createdAt: daysFromNow(-1),
          user: USER,
        },
      ]);

      await expect(service.warnExpiring(NOW)).resolves.toBe(0);
      expect(mail.sendApiKeyExpiring).not.toHaveBeenCalled();
      expect(prisma.apiKey.update).toHaveBeenCalled();
    });
  });

  describe("deleteUnused", () => {
    it("deletes keys idle for a year, never-used ones included, and logs each", async () => {
      const { service, prisma, security, auth } = setup([
        { id: "key-1", userId: "user-1", name: "Vieux script" },
      ]);

      await expect(service.deleteUnused(NOW)).resolves.toBe(1);

      const cutoff = daysFromNow(-365);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { lastUsedAt: { lt: cutoff } },
              { lastUsedAt: null, createdAt: { lt: cutoff } },
            ],
          },
        }),
      );
      expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({
        where: { id: "key-1" },
      });
      expect(auth.invalidate).toHaveBeenCalledWith("key-1");
      expect(security.record).toHaveBeenCalledWith({
        type: "API_KEY_REVOKED",
        userId: "user-1",
        detail: "Vieux script",
      });
    });
  });
});
