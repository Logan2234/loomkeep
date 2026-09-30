import { MAX_API_KEYS_PER_USER } from "@loomkeep/shared";
import { afterEach, beforeEach, vi } from "vitest";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { ApiKeyAuthService } from "./api-key-auth.service";
import { hashApiKey } from "./api-key-auth.service";
import { ApiKeysService } from "./api-keys.service";

const NOW = new Date("2026-10-01T12:00:00Z");

function setup({ count = 0, existing = true } = {}) {
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
    },
  };
  const auth = { invalidate: vi.fn() };
  const security = { record: vi.fn() };
  const mail = { sendApiKeyCreated: vi.fn() };
  const service = new ApiKeysService(
    prisma as unknown as PrismaService,
    auth as unknown as ApiKeyAuthService,
    security as unknown as SecurityEventService,
    mail as unknown as MailService,
  );
  return { service, prisma, auth, security, mail };
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

      expect(secret).toMatch(/^lk_[A-Za-z0-9_-]{43}$/);
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
