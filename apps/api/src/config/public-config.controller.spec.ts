import type { ConfigService } from "@nestjs/config";
import { PublicConfigController } from "./public-config.controller";

function makeController(env: Record<string, string | undefined>) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;

  return { controller: new PublicConfigController(config), config };
}

describe("PublicConfigController", () => {
  it('reports socialEnabled=true only when SOCIAL_ENABLED is exactly "true"', () => {
    const { controller } = makeController({ SOCIAL_ENABLED: "true" });
    expect(controller.get()).toEqual({
      socialEnabled: true,
      registrationEnabled: true,
      erdEnabled: false,
    });
  });

  it("reports socialEnabled=false when the flag is unset", () => {
    const { controller } = makeController({});
    expect(controller.get()).toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: false,
    });
  });

  it('treats any non-"true" value as disabled', () => {
    const { controller } = makeController({ SOCIAL_ENABLED: "1" });
    expect(controller.get()).toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: false,
    });
  });

  it('reports registrationEnabled=false only when REGISTRATION_ENABLED is exactly "false"', () => {
    const { controller } = makeController({ REGISTRATION_ENABLED: "false" });
    expect(controller.get()).toEqual({
      socialEnabled: false,
      registrationEnabled: false,
      erdEnabled: false,
    });
  });

  it("reports registrationEnabled=true when the flag is unset", () => {
    const { controller } = makeController({});
    expect(controller.get()).toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: false,
    });
  });

  it("reports erdEnabled=true only when NODE_ENV is exactly development", () => {
    const { controller } = makeController({ NODE_ENV: "development" });
    expect(controller.get()).toEqual({
      socialEnabled: false,
      registrationEnabled: true,
      erdEnabled: true,
    });
  });
});
