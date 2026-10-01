import { afterEach, beforeEach, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { ApiKeyAuthService, hashApiKey } from "./api-key-auth.service";

const ROW = {
  id: "key-1",
  userId: "user-1",
  scopes: ["library:read"],
  expiresAt: null as Date | null,
  user: { email: "alice@example.com" },
};

function makePrisma(row: typeof ROW | null = ROW) {
  return {
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe("ApiKeyAuthService", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-01T12:00:00Z") }));
  afterEach(() => vi.useRealTimers());

  it("looks a key up by the hash of its secret, never the secret itself", async () => {
    const prisma = makePrisma();
    const service = new ApiKeyAuthService(prisma as unknown as PrismaService);

    await expect(
      service.authenticate("lk_secret", "203.0.113.7"),
    ).resolves.toEqual({
      keyId: "key-1",
      userId: "user-1",
      email: "alice@example.com",
      scopes: ["library:read"],
      expiresAt: null,
    });
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashApiKey("lk_secret") },
      }),
    );
  });

  it("returns null for an unknown key", async () => {
    const service = new ApiKeyAuthService(
      makePrisma(null) as unknown as PrismaService,
    );

    await expect(
      service.authenticate("lk_nope", undefined),
    ).resolves.toBeNull();
  });

  it("returns null once the key has expired", async () => {
    const service = new ApiKeyAuthService(
      makePrisma({
        ...ROW,
        expiresAt: new Date("2026-10-01T11:59:59Z"),
      }) as unknown as PrismaService,
    );

    await expect(
      service.authenticate("lk_secret", undefined),
    ).resolves.toBeNull();
  });

  it("records the last use at most once a minute", async () => {
    const prisma = makePrisma();
    const service = new ApiKeyAuthService(prisma as unknown as PrismaService);

    await service.authenticate("lk_secret", "203.0.113.7");
    await service.authenticate("lk_secret", "203.0.113.7");
    expect(prisma.apiKey.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: {
        lastUsedAt: new Date("2026-10-01T12:00:00Z"),
        lastUsedIp: "203.0.113.7",
      },
    });

    vi.advanceTimersByTime(60_000);
    await service.authenticate("lk_secret", "203.0.113.8");
    expect(prisma.apiKey.updateMany).toHaveBeenCalledTimes(2);
  });

  it("serves repeat lookups from cache until the key is invalidated", async () => {
    const prisma = makePrisma();
    const service = new ApiKeyAuthService(prisma as unknown as PrismaService);

    await service.authenticate("lk_secret", undefined);
    await service.authenticate("lk_secret", undefined);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(1);

    service.invalidate("key-1");
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(
      service.authenticate("lk_secret", undefined),
    ).resolves.toBeNull();
  });
});
