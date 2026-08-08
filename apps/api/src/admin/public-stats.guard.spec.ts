import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
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
      UnauthorizedException,
    );
  });

  it("rejects a token of a different length than the configured key", () => {
    process.env.HOMEPAGE_STATS_API_KEY = "correct-key";
    expect(() => guard.canActivate(contextFor("Bearer short"))).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a request with no authorization header", () => {
    process.env.HOMEPAGE_STATS_API_KEY = "correct-key";
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it("fails closed when HOMEPAGE_STATS_API_KEY isn't configured", () => {
    delete process.env.HOMEPAGE_STATS_API_KEY;
    expect(() => guard.canActivate(contextFor("Bearer anything"))).toThrow(
      UnauthorizedException,
    );
  });
});
