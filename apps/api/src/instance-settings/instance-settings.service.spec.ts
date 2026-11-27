import { DEFAULT_INSTANCE_SETTINGS } from "@loomkeep/shared/contracts";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { InstanceSettingsService } from "./instance-settings.service";
import { setStoredInstanceSettings } from "./instance-settings.store";

function setup(env: Record<string, string> = {}, { stored = true } = {}) {
  let row = { id: 1, ...DEFAULT_INSTANCE_SETTINGS, updatedAt: new Date() };
  const prisma = {
    user: {
      count: vi.fn(
        ({ where }: { where: { enabledDomains: { has: string } } }) =>
          Promise.resolve(where.enabledDomains.has === "MEDIA" ? 7 : 2),
      ),
    },
    instanceSettings: {
      findUnique: vi.fn(() => Promise.resolve(stored ? row : null)),
      create: vi.fn(({ data }: { data: object }) => {
        row = { ...row, ...data };
        return Promise.resolve(row);
      }),
      upsert: vi.fn(({ update }: { update: object }) => {
        row = { ...row, ...update };
        return Promise.resolve(row);
      }),
    },
  };
  const config = {
    get: vi.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  const service = new InstanceSettingsService(
    prisma as unknown as PrismaService,
    config,
  );
  return { service, prisma };
}

describe("InstanceSettingsService", () => {
  afterEach(() => setStoredInstanceSettings(DEFAULT_INSTANCE_SETTINGS));

  it("serves the stored row, saved changes included", async () => {
    const { service } = setup();
    await service.onModuleInit();

    expect(service.get("socialEnabled")).toBe(false);
    await service.update({ socialEnabled: true, apiRateLimitFree: 120 });

    expect(service.get("socialEnabled")).toBe(true);
    expect(service.get("apiRateLimitFree")).toBe(120);
  });

  it("creates the row from the env vars of its first boot, so dropping them later changes nothing", async () => {
    const { service, prisma } = setup(
      { SOCIAL_ENABLED: "true", API_RATE_LIMIT_FREE: "30" },
      { stored: false },
    );
    await service.onModuleInit();

    expect(prisma.instanceSettings.create).toHaveBeenCalledWith({
      data: {
        id: 1,
        ...DEFAULT_INSTANCE_SETTINGS,
        socialEnabled: true,
        apiRateLimitFree: 30,
      },
    });
  });

  it("lets a set env var win and reports the setting as locked", async () => {
    const { service } = setup({
      SOCIAL_ENABLED: "true",
      API_RATE_LIMIT_FREE: "30",
    });
    await service.onModuleInit();

    expect(service.toDto()).toEqual({
      values: {
        ...DEFAULT_INSTANCE_SETTINGS,
        socialEnabled: true,
        apiRateLimitFree: 30,
      },
      lockedBy: {
        socialEnabled: "SOCIAL_ENABLED",
        apiRateLimitFree: "API_RATE_LIMIT_FREE",
      },
      missingEnv: {
        mediaDomainEnabled: ["TMDB_API_TOKEN"],
        gamesDomainEnabled: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
      },
    });
  });

  it("refuses to change a setting an env var pins", async () => {
    const { service, prisma } = setup({ REGISTRATION_ENABLED: "false" });
    await service.onModuleInit();

    await expect(
      service.update({ registrationEnabled: true }),
    ).rejects.toMatchObject({ code: "admin.setting_locked_by_env" });
    expect(prisma.instanceSettings.upsert).not.toHaveBeenCalled();
  });

  it("refuses a change that would leave the instance without a domain", async () => {
    // No catalogue key: media and games are off already, whatever their toggle.
    const { service, prisma } = setup();
    await service.onModuleInit();

    await service.update({ booksDomainEnabled: false });
    await expect(
      service.update({ musicDomainEnabled: false }),
    ).rejects.toMatchObject({ code: "admin.no_domain_left" });
    expect(prisma.instanceSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it("counts, for each domain, the accounts that keep it enabled", async () => {
    const { service } = setup();

    await expect(service.domainAccounts()).resolves.toEqual({
      MEDIA: 7,
      GAMES: 2,
      BOOKS: 2,
      MUSIC: 2,
    });
  });

  it("keeps the env-era parsing: registration open unless exactly false", async () => {
    const { service } = setup({ REGISTRATION_ENABLED: "1" });

    expect(service.get("registrationEnabled")).toBe(true);
  });
});
