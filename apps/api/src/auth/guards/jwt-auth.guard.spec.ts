import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import type { FastifyReply } from "fastify";
import { afterEach, beforeEach, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { setAuthCookies } from "../auth-cookies";
import { SessionCacheService } from "../session-cache.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

function makeContext(request: unknown): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(request),
    }),
  } as unknown as ExecutionContext;
}

function makeReflector(isPublic = false): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
}

function makeConfigService(): ConfigService {
  return {
    getOrThrow: vi.fn().mockReturnValue("access-secret"),
  } as unknown as ConfigService;
}

/** Access-token cookie header; the JWT itself is irrelevant since verifyAsync is mocked. */
function makeCookieHeader(): { headers: { cookie: string } } {
  const header = vi.fn();
  setAuthCookies({ header } as unknown as FastifyReply, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });
  return {
    headers: {
      cookie: (header.mock.calls[0][1] as string[])
        .map((cookie) => cookie.split(";", 1)[0])
        .join("; "),
    },
  };
}

describe("JwtAuthGuard", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_ACCESS_SECRET", "access-secret");
    vi.stubEnv("JWT_REFRESH_SECRET", "refresh-secret");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("reads access tokens from the HttpOnly cookie", async () => {
    const request = makeCookieHeader();
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
      }),
    } as unknown as JwtService;
    const prisma = {
      refreshToken: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(
      jwtService,
      makeConfigService(),
      makeReflector(),
      prisma,
      new SessionCacheService(),
    );

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("access-token", {
      secret: "access-secret",
      algorithms: ["HS256"],
      issuer: "loomkeep-api",
      audience: "loomkeep-web",
    });
    // Payload carries no `sid` (a pre-sid token) — no DB check performed.
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it("does not accept a Bearer token outside the HttpOnly cookie", async () => {
    const request = { headers: { authorization: "Bearer access-token" } };
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
      }),
    } as unknown as JwtService;
    const prisma = {
      refreshToken: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(
      jwtService,
      makeConfigService(),
      makeReflector(),
      prisma,
      new SessionCacheService(),
    );

    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject(
      { status: 401 },
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("rejects a token whose sid no longer names a live session", async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
        sid: "revoked-session",
      }),
    } as unknown as JwtService;
    const prisma = {
      refreshToken: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(
      jwtService,
      makeConfigService(),
      makeReflector(),
      prisma,
      new SessionCacheService(),
    );

    await expect(
      guard.canActivate(makeContext(makeCookieHeader())),
    ).rejects.toMatchObject({ status: 401 });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { id: "revoked-session" },
      select: { id: true },
    });
  });

  it("accepts a live sid and caches it, skipping the DB on the next call", async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
        sid: "live-session",
      }),
    } as unknown as JwtService;
    const prisma = {
      refreshToken: {
        findUnique: vi.fn().mockResolvedValue({ id: "live-session" }),
      },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(
      jwtService,
      makeConfigService(),
      makeReflector(),
      prisma,
      new SessionCacheService(),
    );
    const request = makeCookieHeader();

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);

    expect(prisma.refreshToken.findUnique).toHaveBeenCalledTimes(1);
  });
});
