import type { ConfigService } from "@nestjs/config";
import { PublicConfigController } from "./public-config.controller";

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn().mockResolvedValue(JSON.stringify({ version: "9.9.9" })),
}));

function makeController(env: Record<string, string | undefined>) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;

  return { controller: new PublicConfigController(config), config };
}

describe("PublicConfigController", () => {
  const ORIGINAL_GIT_SHA = process.env.GIT_SHA;

  afterEach(() => {
    process.env.GIT_SHA = ORIGINAL_GIT_SHA;
  });

  it('reports socialEnabled=true only when SOCIAL_ENABLED is exactly "true"', async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ SOCIAL_ENABLED: "true" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: true,
      registrationEnabled: true,
      erdEnabled: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("reports socialEnabled=false when the flag is unset", async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({});
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it('treats any non-"true" value as disabled', async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ SOCIAL_ENABLED: "1" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it('reports registrationEnabled=false only when REGISTRATION_ENABLED is exactly "false"', async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ REGISTRATION_ENABLED: "false" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      registrationEnabled: false,
      erdEnabled: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("reports registrationEnabled=true when the flag is unset", async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({});
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: false,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("reports erdEnabled=true only when NODE_ENV is exactly development", async () => {
    delete process.env.GIT_SHA;
    const { controller } = makeController({ NODE_ENV: "development" });
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: true,
      version: "9.9.9",
      gitSha: "unknown",
    });
  });

  it("truncates GIT_SHA to 7 characters", async () => {
    process.env.GIT_SHA = "a1b2c3d4e5f6";
    const { controller } = makeController({});
    await expect(controller.get()).resolves.toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: false,
      version: "9.9.9",
      gitSha: "a1b2c3d",
    });
  });
});
