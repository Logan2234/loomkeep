import type { ConfigService } from "@nestjs/config";
import { envOverride } from "./instance-settings.store";

const configWith = (env: Record<string, string>) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService;

describe("envOverride", () => {
  it.each(["false", "0", "no", "off", "FALSE"])(
    "reads REGISTRATION_ENABLED=%s as closed",
    (raw) => {
      expect(
        envOverride(
          configWith({ REGISTRATION_ENABLED: raw }),
          "registrationEnabled",
        ),
      ).toBe(false);
    },
  );

  it.each(["true", "1", "yes", "on"])(
    "reads SOCIAL_ENABLED=%s as on",
    (raw) => {
      expect(
        envOverride(configWith({ SOCIAL_ENABLED: raw }), "socialEnabled"),
      ).toBe(true);
    },
  );

  it("ignores a boolean it can't read rather than guessing either way", () => {
    expect(
      envOverride(
        configWith({ REGISTRATION_ENABLED: "nope" }),
        "registrationEnabled",
      ),
    ).toBeNull();
  });

  it("reads a rate limit as a whole number", () => {
    expect(
      envOverride(
        configWith({ API_RATE_LIMIT_FREE: "120" }),
        "apiRateLimitFree",
      ),
    ).toBe(120);
  });

  it.each(["abc", "-5", "1.5", "Infinity"])(
    "ignores API_RATE_LIMIT_FREE=%s instead of turning it into NaN",
    (raw) => {
      expect(
        envOverride(
          configWith({ API_RATE_LIMIT_FREE: raw }),
          "apiRateLimitFree",
        ),
      ).toBeNull();
    },
  );
});
