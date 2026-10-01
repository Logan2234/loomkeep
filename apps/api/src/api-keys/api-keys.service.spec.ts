import { MAX_API_KEYS_PER_USER } from "@loomkeep/shared";
import { afterEach, beforeEach, vi } from "vitest";
import type { InstanceSettingsService } from "../instance-settings/instance-settings.service";
import type { MailService } from "../mail/mail.service";
import type { NotificationService } from "../notifications/notification.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { ApiKeyAuthService } from "./api-key-auth.service";
import { hashApiKey } from "./api-key-auth.service";
import { ApiKeysService } from "./api-keys.service";

const NOW = new Date("2026-10-01T12:00:00Z");

function setup({ count = 0, existing = true, apiEnabled = true } = {}) {
  const prisma = {
    apiKey: {
      count: vi.fn().mockResolvedValue(count),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "key-1",
          lastUsedAt: null,
          lastUsedIp: null,
          createdAt: NOW,
          ...data,
          user: { email: "alice@example.com", locale: "fr" },
        }),
      ),
      findFirst: vi
        .fn()
        .mockResolvedValue(existing ? { name: "Script perso" } : null),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([
        { id: "key-1", name: "Script perso" },
        { id: "key-2", name: "Sauvegarde" },
      ]),
    },
  };
  const auth = { invalidate: vi.fn() };
  const security = { record: vi.fn() };
  const mail = { sendApiKeyCreated: vi.fn() };
  const notifications = { create: vi.fn() };
  const service = new ApiKeysService(
    prisma as unknown as PrismaService,
    auth as unknown as ApiKeyAuthService,
    security as unknown as SecurityEventService,
    mail as unknown as MailService,
    notifications as unknown as NotificationService,
    { get: () => apiEnabled } as unknown as InstanceSettingsService,
  );
  return { service, prisma, auth, security, mail, notifications };
}

describe("ApiKeysService", () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  describe("create", () => {
    it("returns the secret once and stores only its hash", async () => {
      const { service, prisma } = setup();

      const { apiKey, secret } = await service.create("user-1", {
        name: "  Script perso  ",
        scopes: ["stats:read", "library:read"],
        expiresAt: null,
      });

      expect(secret).toMatch(/^lk_[0-9A-Za-z]{49}$/);
      const { data } = prisma.apiKey.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(hashApiKey(secret));
      expect(JSON.stringify(data)).not.toContain(secret);
      expect(apiKey).toMatchObject({
        name: "Script perso",
        suffix: secret.slice(-4),
        // Stored in the canonical resource order, whatever the request's.
        scopes: ["library:read", "stats:read"],
        expiresAt: null,
      });
    });

    it("warns the owner by email and logs a security event", async () => {
      const { service, security, mail } = setup();

      await service.create("user-1", {
        name: "Script perso",
        scopes: ["library:read"],
        expiresAt: null,
      });

      expect(security.record).toHaveBeenCalledWith({
        type: "API_KEY_CREATED",
        userId: "user-1",
        detail: "Script perso",
      });
      expect(mail.sendApiKeyCreated).toHaveBeenCalledWith(
        { email: "alice@example.com", locale: "fr" },
        "Script perso",
      );
    });

    it("rejects an expiration date that has already passed", async () => {
      const { service, prisma } = setup();

      await expect(
        service.create("user-1", {
          name: "Script perso",
          scopes: ["library:read"],
          expiresAt: "2026-10-01T11:00:00Z",
        }),
      ).rejects.toMatchObject({ code: "api_key.expiry_in_past" });
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });

    it("refuses new keys while the instance has the API turned off", async () => {
      const { service, prisma } = setup({ apiEnabled: false });

      await expect(
        service.create("user-1", {
          name: "Script perso",
          scopes: ["library:read"],
          expiresAt: null,
        }),
      ).rejects.toMatchObject({ code: "api.disabled" });
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });

    it("stops at the safety cap", async () => {
      const { service, prisma } = setup({ count: MAX_API_KEYS_PER_USER });

      await expect(
        service.create("user-1", {
          name: "Script perso",
          scopes: ["library:read"],
          expiresAt: null,
        }),
      ).rejects.toMatchObject({ code: "api_key.limit_reached" });
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });
  });

  describe("revokeAll", () => {
    it("deletes every key of the caller and evicts each from the auth cache", async () => {
      const { service, prisma, auth, security } = setup();

      await service.revokeAll("user-1");

      expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(auth.invalidate).toHaveBeenCalledWith("key-1");
      expect(auth.invalidate).toHaveBeenCalledWith("key-2");
      expect(security.record).toHaveBeenCalledTimes(2);
    });
  });

  describe("reviewAfterPasswordChange", () => {
    it("asks for a review in the bell while active keys remain", async () => {
      const { service, prisma, notifications } = setup({ count: 2 });

      await expect(service.reviewAfterPasswordChange("user-1")).resolves.toBe(
        2,
      );
      expect(prisma.apiKey.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
        },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "API_KEYS_REVIEW",
          url: "/app/settings/integrations",
          data: { count: 2 },
        }),
      );
    });

    it("stays silent without an active key", async () => {
      const { service, notifications } = setup({ count: 0 });

      await expect(service.reviewAfterPasswordChange("user-1")).resolves.toBe(
        0,
      );
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe("revoke", () => {
    it("deletes the key, evicts it from the auth cache and logs it", async () => {
      const { service, prisma, auth, security } = setup();

      await service.revoke("user-1", "key-1");

      expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({
        where: { id: "key-1", userId: "user-1" },
      });
      expect(auth.invalidate).toHaveBeenCalledWith("key-1");
      expect(security.record).toHaveBeenCalledWith({
        type: "API_KEY_REVOKED",
        userId: "user-1",
        detail: "Script perso",
      });
    });

    it("refuses a key that belongs to someone else", async () => {
      const { service, prisma } = setup({ existing: false });

      await expect(service.revoke("user-2", "key-1")).rejects.toMatchObject({
        code: "api_key.not_found",
      });
      expect(prisma.apiKey.deleteMany).not.toHaveBeenCalled();
    });
  });
});
