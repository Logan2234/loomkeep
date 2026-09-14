import { ErrorCode } from "@loomkeep/shared";
import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { MetricsGuard } from "./metrics.guard";

// Reads process.env on each call, so the env-based setup below still drives
// every case even though the guard goes through ConfigService.
const envConfig = {
  get: (key: string) => process.env[key],
} as unknown as ConfigService;

function contextFor(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe("MetricsGuard", () => {
  const guard = new MetricsGuard(envConfig);
  const ORIGINAL_ENV = process.env.METRICS_API_KEY;

  afterEach(() => {
    process.env.METRICS_API_KEY = ORIGINAL_ENV;
  });

  it("allows a scrape presenting the matching bearer token", () => {
    process.env.METRICS_API_KEY = "correct-key";
    expect(guard.canActivate(contextFor("Bearer correct-key"))).toBe(true);
  });

  it("rejects a wrong token, a shorter one, and no header at all", () => {
    process.env.METRICS_API_KEY = "correct-key";

    for (const header of ["Bearer wrong-key", "Bearer short", undefined]) {
      expect(() => guard.canActivate(contextFor(header))).toThrow(AppException);
    }
  });

  it("fails closed when METRICS_API_KEY isn't configured", () => {
    // The endpoint is unauthenticated otherwise, and the base compose file
    // publishes the API port with no reverse proxy in front.
    delete process.env.METRICS_API_KEY;

    try {
      guard.canActivate(contextFor("Bearer anything"));
      throw new Error("expected canActivate to throw");
    } catch (err) {
      expect((err as AppException).code).toBe(ErrorCode.AdminUnauthorized);
    }
  });

  it("does not accept the Homepage stats key", () => {
    // Separate consumers, separate credentials — see the guard's doc comment.
    process.env.METRICS_API_KEY = "metrics-key";
    process.env.HOMEPAGE_STATS_API_KEY = "homepage-key";

    expect(() => guard.canActivate(contextFor("Bearer homepage-key"))).toThrow(
      AppException,
    );
  });
});
