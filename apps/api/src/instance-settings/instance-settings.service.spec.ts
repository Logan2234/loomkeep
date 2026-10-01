import { DEFAULT_INSTANCE_SETTINGS } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { afterEach, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { InstanceSettingsService } from "./instance-settings.service";
import { setStoredInstanceSettings } from "./instance-settings.store";

function setup(env: Record<string, string> = {}) {
  let row = { id: 1, ...DEFAULT_INSTANCE_SETTINGS, updatedAt: new Date() };
  const prisma = {
    instanceSettings: {
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
    });
  });

  it("refuses to change a setting an env var pins", async () => {
    const { service, prisma } = setup({ REGISTRATION_ENABLED: "false" });
    await service.onModuleInit();
    prisma.instanceSettings.upsert.mockClear();

    await expect(
      service.update({ registrationEnabled: true }),
    ).rejects.toMatchObject({ code: "admin.setting_locked_by_env" });
    expect(prisma.instanceSettings.upsert).not.toHaveBeenCalled();
  });

  it("keeps the env-era parsing: registration open unless exactly false", async () => {
    const { service } = setup({ REGISTRATION_ENABLED: "1" });

    expect(service.get("registrationEnabled")).toBe(true);
  });
});
