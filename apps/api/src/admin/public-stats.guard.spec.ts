import { ErrorCode } from "@loomkeep/shared";
import type { ExecutionContext } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { PublicStatsGuard } from "./public-stats.guard";

function contextFor(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

describe("PublicStatsGuard", () => {
  const guard = new PublicStatsGuard();
  const ORIGINAL_ENV = process.env.HOMEPAGE_STATS_API_KEY;

  afterEach(() => {
    process.env.HOMEPAGE_STATS_API_KEY = ORIGINAL_ENV;
  });

  it("allows a request with the matching bearer token", () => {
    process.env.HOMEPAGE_STATS_API_KEY = "correct-key";
    expect(guard.canActivate(contextFor("Bearer correct-key"))).toBe(true);
  });

  it("rejects a request with the wrong token", () => {
    process.env.HOMEPAGE_STATS_API_KEY = "correct-key";
    expect(() => guard.canActivate(contextFor("Bearer wrong-key"))).toThrow(
      AppException,
    );
  });

  it("rejects a token of a different length than the configured key", () => {
    process.env.HOMEPAGE_STATS_API_KEY = "correct-key";

    try {
      guard.canActivate(contextFor("Bearer short"));
      throw new Error("expected canActivate to throw");
    } catch (err) {
      expect((err as AppException).code).toBe(ErrorCode.AdminUnauthorized);
    }
  });

  it("rejects a request with no authorization header", () => {
    process.env.HOMEPAGE_STATS_API_KEY = "correct-key";
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      AppException,
    );
  });

  it("fails closed when HOMEPAGE_STATS_API_KEY isn't configured", () => {
    delete process.env.HOMEPAGE_STATS_API_KEY;
    expect(() => guard.canActivate(contextFor("Bearer anything"))).toThrow(
      AppException,
    );
  });
});
