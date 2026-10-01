import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { PublicConfigController } from "./public-config.controller";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(JSON.stringify({ version: "9.9.9" })),
}));

function makeController(env: Record<string, string | undefined>) {
  const config = {
    get: vi.fn((key: string) => env[key]),
  } as unknown as ConfigService;

  return {
    controller: new PublicConfigController(config),
    config,
  };
}

describe("PublicConfigController", () => {
  const ORIGINAL_GIT_SHA = process.env.GIT_SHA;

  afterEach(() => {
    process.env.GIT_SHA = ORIGINAL_GIT_SHA;
  });

  it('reports publicApiEnabled=false only when PUBLIC_API_ENABLED is "false"', async () => {
    const off = makeController({ PUBLIC_API_ENABLED: "false" });
    await expect(off.controller.get()).resolves.toMatchObject({
      publicApiEnabled: false,
    });
    const unset = makeController({});
    await expect(unset.controller.get()).resolves.toMatchObject({
      publicApiEnabled: true,
    });
  });

  it('reports socialEnabled=true only when SOCIAL_ENABLED is exactly "true"', async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ SOCIAL_ENABLED: "true" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: true,
      gamificationEnabled: false,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it('reports gamificationEnabled=true only when GAMIFICATION_ENABLED is exactly "true"', async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ GAMIFICATION_ENABLED: "true" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: true,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("reports socialEnabled=false when the flag is unset", async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({});
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: false,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it('treats any non-"true" value as disabled', async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ SOCIAL_ENABLED: "1" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: false,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it('reports registrationEnabled=false only when REGISTRATION_ENABLED is exactly "false"', async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ REGISTRATION_ENABLED: "false" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: false,
      registrationEnabled: false,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("reports registrationEnabled=true when the flag is unset", async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({});
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: false,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("reports erdEnabled=true only when NODE_ENV is exactly development", async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ NODE_ENV: "development" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: false,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: true,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("reports adminMfaEnforced=true only when NODE_ENV is exactly production", async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ NODE_ENV: "production" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: false,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: true,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("truncates GIT_SHA to 7 characters", async () => {
    process.env.GIT_SHA = "a1b2c3d4e5f6";
    const { controller } = makeController({});
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      gamificationEnabled: false,
      registrationEnabled: true,
      publicApiEnabled: true,
      erdEnabled: false,
      adminMfaEnforced: false,
      version: "9.9.9",
      gitSha: "a1b2c3d",
    });
  });
});
