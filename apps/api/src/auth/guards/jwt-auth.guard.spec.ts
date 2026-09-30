import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import type { FastifyReply } from "fastify";
import { afterEach, beforeEach, vi } from "vitest";
import {
  API_KEY_ACCESS_KEY,
  type ApiKeyAccess,
} from "../../api-keys/api-key-access.decorator";
import type {
  ApiKeyAuthService,
  ApiKeyPrincipal,
} from "../../api-keys/api-key-auth.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { setAuthCookies } from "../auth-cookies";
import { SessionCacheService } from "../session-cache.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

function makeContext(request: unknown): ExecutionContext {
  return {
    getType: vi.fn().mockReturnValue("http"),
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

/** A reflector for a non-public route, with the given @AllowApiKey metadata. */
function makeApiKeyReflector(access?: ApiKeyAccess): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) =>
      key === API_KEY_ACCESS_KEY ? access : false,
    ),
  } as unknown as Reflector;
}

function makeApiKeys(principal: ApiKeyPrincipal | null = null) {
  return {
    authenticate: vi.fn().mockResolvedValue(principal),
  } as unknown as ApiKeyAuthService & {
    authenticate: ReturnType<typeof vi.fn>;
  };
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

  it("passes through non-HTTP contexts untouched (EventsGateway's @SubscribeMessage handlers)", async () => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const prisma = {
      refreshToken: { findUnique: vi.fn() },
    } as unknown as PrismaService;
    const guard = new JwtAuthGuard(
      jwtService,
      makeConfigService(),
      makeReflector(),
      prisma,
      new SessionCacheService(),
      makeApiKeys(),
    );
    // A WS context has no HTTP request to read a cookie from — the socket's
    // own connection already went through the equivalent check once, at the
    // handshake (see EventsGateway.handleConnection). Reading the request
    // here would crash because the WebSocket context has no HTTP request.
    const wsContext = {
      getType: vi.fn().mockReturnValue("ws"),
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({ getRequest: vi.fn() }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(wsContext)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

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
      makeApiKeys(),
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
      makeApiKeys(),
    );

    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject(
      { status: 401 },
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  describe("API keys", () => {
    const PRINCIPAL: ApiKeyPrincipal = {
      keyId: "key-1",
      userId: "user-1",
      email: "alice@example.com",
      scopes: ["library:read"],
      expiresAt: null,
    };

    function makeGuard(
      apiKeys: ApiKeyAuthService,
      access?: ApiKeyAccess,
    ): JwtAuthGuard {
      return new JwtAuthGuard(
        { verifyAsync: vi.fn() } as unknown as JwtService,
        makeConfigService(),
        makeApiKeyReflector(access),
        { refreshToken: { findUnique: vi.fn() } } as unknown as PrismaService,
        new SessionCacheService(),
        apiKeys,
      );
    }

    const bearer = (secret: string) => ({
      headers: { authorization: `Bearer ${secret}` },
      ip: "203.0.113.7",
    });

    it("authenticates a key on a route opened to its resource", async () => {
      const apiKeys = makeApiKeys(PRINCIPAL);
      const request: ReturnType<typeof bearer> & { user?: unknown } =
        bearer("lk_secret");

      await expect(
        makeGuard(apiKeys, { resource: "library" }).canActivate(
          makeContext(request),
        ),
      ).resolves.toBe(true);
      expect(apiKeys.authenticate).toHaveBeenCalledWith(
        "lk_secret",
        "203.0.113.7",
      );
      expect(request.user).toEqual({
        sub: "user-1",
        email: "alice@example.com",
        apiKeyId: "key-1",
      });
    });

    it("lets any valid key through a route that needs no resource", async () => {
      await expect(
        makeGuard(makeApiKeys(PRINCIPAL), { resource: null }).canActivate(
          makeContext(bearer("lk_secret")),
        ),
      ).resolves.toBe(true);
    });

    it("refuses a valid key on a route not opened to API keys", async () => {
      await expect(
        makeGuard(makeApiKeys(PRINCIPAL)).canActivate(
          makeContext(bearer("lk_secret")),
        ),
      ).rejects.toMatchObject({
        status: 403,
        code: "auth.api_key_forbidden",
      });
    });

    it("refuses a key that wasn't granted the route's resource", async () => {
      await expect(
        makeGuard(makeApiKeys(PRINCIPAL), { resource: "lists" }).canActivate(
          makeContext(bearer("lk_secret")),
        ),
      ).rejects.toMatchObject({
        status: 403,
        code: "auth.api_key_forbidden",
      });
    });

    it("rejects an unknown, expired or revoked key before checking access", async () => {
      await expect(
        makeGuard(makeApiKeys(null), { resource: "library" }).canActivate(
          makeContext(bearer("lk_unknown")),
        ),
      ).rejects.toMatchObject({ status: 401, code: "auth.invalid_api_key" });
    });

    it("never looks up a bearer value that isn't an API key", async () => {
      const apiKeys = makeApiKeys(PRINCIPAL);

      await expect(
        makeGuard(apiKeys, { resource: null }).canActivate(
          makeContext(bearer("some-jwt")),
        ),
      ).rejects.toMatchObject({ status: 401 });
      expect(apiKeys.authenticate).not.toHaveBeenCalled();
    });

    it("ignores the Authorization header when a session cookie is present", async () => {
      const apiKeys = makeApiKeys(PRINCIPAL);
      const jwtService = {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: "user-2",
          email: "bob@example.com",
        }),
      } as unknown as JwtService;
      const guard = new JwtAuthGuard(
        jwtService,
        makeConfigService(),
        makeApiKeyReflector(),
        { refreshToken: { findUnique: vi.fn() } } as unknown as PrismaService,
        new SessionCacheService(),
        apiKeys,
      );
      const cookie = makeCookieHeader();
      const request = {
        headers: { ...cookie.headers, authorization: "Bearer lk_secret" },
      };

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
      expect(apiKeys.authenticate).not.toHaveBeenCalled();
    });
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
      makeApiKeys(),
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
      makeApiKeys(),
    );
    const request = makeCookieHeader();

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);

    expect(prisma.refreshToken.findUnique).toHaveBeenCalledTimes(1);
  });
});
