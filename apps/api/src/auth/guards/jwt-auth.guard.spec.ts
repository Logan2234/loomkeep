import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import type { FastifyReply } from "fastify";
import { afterEach, beforeEach, vi } from "vitest";
import { setAuthCookies } from "../auth-cookies";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_ACCESS_SECRET", "access-secret");
    vi.stubEnv("JWT_REFRESH_SECRET", "refresh-secret");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("reads access tokens from the HttpOnly cookie", async () => {
    const header = vi.fn();
    setAuthCookies({ header } as unknown as FastifyReply, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    const request = {
      headers: {
        cookie: (header.mock.calls[0][1] as string[])
          .map((cookie) => cookie.split(";", 1)[0])
          .join("; "),
      },
    };
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
      }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      jwtService,
      {
        getOrThrow: vi.fn().mockReturnValue("access-secret"),
      } as unknown as ConfigService,
      {
        getAllAndOverride: vi.fn().mockReturnValue(false),
      } as unknown as Reflector,
    );
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("access-token", {
      secret: "access-secret",
      algorithms: ["HS256"],
      issuer: "loomkeep-api",
      audience: "loomkeep-web",
    });
  });

  it("does not accept a Bearer token outside the HttpOnly cookie", async () => {
    const request = { headers: { authorization: "Bearer access-token" } };
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
      }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      jwtService,
      {
        getOrThrow: vi.fn().mockReturnValue("access-secret"),
      } as unknown as ConfigService,
      {
        getAllAndOverride: vi.fn().mockReturnValue(false),
      } as unknown as Reflector,
    );
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });
});
