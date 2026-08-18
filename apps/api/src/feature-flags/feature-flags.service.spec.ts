import type { ConfigService } from "@nestjs/config";
import { FeatureFlagsService } from "./feature-flags.service";

const fakeClient = {
  on: jest.fn(),
  isEnabled: jest.fn(),
  destroy: jest.fn(),
};

jest.mock("unleash-client", () => ({
  initialize: jest.fn(() => fakeClient),
}));

function fakeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
}

describe("FeatureFlagsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the fallback and never talks to Unleash when UNLEASH_API_URL is unset", () => {
    const service = new FeatureFlagsService(fakeConfig({}));
    service.onModuleInit();

    expect(service.isEnabled("SOCIAL_ENABLED", true)).toBe(true);
    expect(service.isEnabled("SOCIAL_ENABLED")).toBe(false);
    expect(fakeClient.isEnabled).not.toHaveBeenCalled();
  });

  it("delegates to the Unleash client when UNLEASH_API_URL is set", () => {
    const service = new FeatureFlagsService(
      fakeConfig({
        UNLEASH_API_URL: "http://unleash:4242/api",
        UNLEASH_API_TOKEN: "token",
      }),
    );
    service.onModuleInit();
    fakeClient.isEnabled.mockReturnValue(true);

    expect(service.isEnabled("MAINTENANCE_BOOKS")).toBe(true);
    expect(fakeClient.isEnabled).toHaveBeenCalledWith(
      "MAINTENANCE_BOOKS",
      undefined,
      false,
    );
  });

  it("destroys the client on module destroy only when it was initialized", () => {
    const withUrl = new FeatureFlagsService(
      fakeConfig({ UNLEASH_API_URL: "http://unleash:4242/api" }),
    );
    withUrl.onModuleInit();
    withUrl.onModuleDestroy();
    expect(fakeClient.destroy).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();

    const withoutUrl = new FeatureFlagsService(fakeConfig({}));
    withoutUrl.onModuleInit();
    withoutUrl.onModuleDestroy();
    expect(fakeClient.destroy).not.toHaveBeenCalled();
  });
});
