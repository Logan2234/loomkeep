import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { FastifyReply } from "fastify";
import type { Socket } from "socket.io";
import { afterEach, beforeEach, vi } from "vitest";
import { setAuthCookies } from "../auth/auth-cookies";
import { SessionCacheService } from "../auth/session-cache.service";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "./events.gateway";

/** Access-token cookie header; the JWT itself is irrelevant since verifyAsync is mocked. */
function cookieHeader(): string {
  const header = vi.fn();
  setAuthCookies({ header } as unknown as FastifyReply, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });
  return (header.mock.calls[0][1] as string[])
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");
}

function fakeSocket(cookie?: string): Socket {
  return {
    id: "socket-1",
    handshake: { headers: { cookie } },
    data: {},
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as Socket;
}

function makeConfig(): ConfigService {
  return {
    getOrThrow: vi.fn().mockReturnValue("access-secret"),
  } as unknown as ConfigService;
}

function makeFlags(): FeatureFlagsService {
  return {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;
}

describe("EventsGateway.handleConnection", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_ACCESS_SECRET", "access-secret");
    vi.stubEnv("JWT_REFRESH_SECRET", "refresh-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function make(role: string | null) {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    } as unknown as JwtService;
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(role ? { role } : null),
      },
      list: { findUnique: vi.fn() },
      listMember: { findUnique: vi.fn() },
      refreshToken: { findUnique: vi.fn().mockResolvedValue({ id: "sid-1" }) },
    } as unknown as PrismaService;
    const flags = makeFlags();
    const sessionCache = new SessionCacheService();
    const gateway = new EventsGateway(
      jwtService,
      makeConfig(),
      prisma,
      flags,
      sessionCache,
    );
    return { gateway, jwtService, prisma, sessionCache };
  }

  it("joins the user's own room on a valid cookie", async () => {
    const { gateway } = make(null);
    const client = fakeSocket(cookieHeader());

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("user:user-1");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects a socket with no access-token cookie", async () => {
    const { gateway } = make(null);
    const client = fakeSocket(undefined);

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it("disconnects a socket whose token fails verification", async () => {
    const { gateway, jwtService } = make(null);
    (jwtService.verifyAsync as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("invalid"),
    );
    const client = fakeSocket(cookieHeader());

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("also joins the admin reports room for an ADMIN account", async () => {
    const { gateway } = make("ADMIN");
    const client = fakeSocket(cookieHeader());

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("admin:reports");
  });

  it("never joins the admin room for a non-admin account", async () => {
    const { gateway } = make("USER");
    const client = fakeSocket(cookieHeader());

    await gateway.handleConnection(client);

    expect(client.join).not.toHaveBeenCalledWith("admin:reports");
  });

  it("disconnects the socket once the connecting token's own expiry is reached", async () => {
    vi.useFakeTimers();
    const { gateway } = make(null);
    const client = fakeSocket(cookieHeader());

    await gateway.handleConnection(client);
    expect(client.disconnect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(900 * 1000 + 1);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("joins the session room for a token carrying a live sid", async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
        sid: "sid-1",
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    } as unknown as JwtService;
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      refreshToken: { findUnique: vi.fn().mockResolvedValue({ id: "sid-1" }) },
    } as unknown as PrismaService;
    const gateway = new EventsGateway(
      jwtService,
      makeConfig(),
      prisma,
      makeFlags(),
      new SessionCacheService(),
    );
    const client = fakeSocket(cookieHeader());

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("session:sid-1");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("rejects a token whose sid no longer names a live session — the WS equivalent of JwtAuthGuard's REST check", async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "alice@example.com",
        sid: "revoked-sid",
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    } as unknown as JwtService;
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      refreshToken: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const gateway = new EventsGateway(
      jwtService,
      makeConfig(),
      prisma,
      makeFlags(),
      new SessionCacheService(),
    );
    const client = fakeSocket(cookieHeader());

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });
});

describe("EventsGateway.disconnectSession", () => {
  it("forces every socket in that session's room to disconnect", () => {
    const gateway = new EventsGateway(
      {} as JwtService,
      makeConfig(),
      {} as PrismaService,
      makeFlags(),
      new SessionCacheService(),
    );
    const disconnectSockets = vi.fn();
    const fakeServer = {
      in: vi.fn().mockReturnValue({ disconnectSockets }),
    };
    (gateway as unknown as { server: unknown }).server = fakeServer;

    gateway.disconnectSession("sid-1");

    expect(fakeServer.in).toHaveBeenCalledWith("session:sid-1");
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });
});

describe("EventsGateway.handleJoinComments", () => {
  function make(socialEnabled: boolean) {
    const prisma = {} as unknown as PrismaService;
    const config = {
      getOrThrow: vi.fn(),
      get: vi.fn(() => (socialEnabled ? "true" : "false")),
    } as unknown as ConfigService;
    const flags = {
      isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
    } as unknown as FeatureFlagsService;
    return new EventsGateway(
      {} as JwtService,
      config,
      prisma,
      flags,
      new SessionCacheService(),
    );
  }

  it("joins the thread room when social is enabled", async () => {
    const gateway = make(true);
    const client = fakeSocket();

    await gateway.handleJoinComments(client, {
      targetType: "MEDIA",
      targetId: "m1",
    });

    expect(client.join).toHaveBeenCalledWith("comments:MEDIA:m1");
  });

  it("silently refuses when social is disabled", async () => {
    const gateway = make(false);
    const client = fakeSocket();

    await gateway.handleJoinComments(client, {
      targetType: "MEDIA",
      targetId: "m1",
    });

    expect(client.join).not.toHaveBeenCalled();
  });
});

describe("EventsGateway.handleJoinList", () => {
  function make(opts: {
    ownerId?: string;
    member?: boolean;
    socialEnabled?: boolean;
  }) {
    const prisma = {
      list: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            opts.ownerId === undefined ? null : { userId: opts.ownerId },
          ),
      },
      listMember: {
        findUnique: vi
          .fn()
          .mockResolvedValue(opts.member ? { id: "m1" } : null),
      },
    } as unknown as PrismaService;
    const config = {
      getOrThrow: vi.fn(),
      get: vi.fn(() => (opts.socialEnabled !== false ? "true" : "false")),
    } as unknown as ConfigService;
    const flags = {
      isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
    } as unknown as FeatureFlagsService;
    return new EventsGateway(
      {} as JwtService,
      config,
      prisma,
      flags,
      new SessionCacheService(),
    );
  }

  it("lets the owner join their own list room", async () => {
    const gateway = make({ ownerId: "user-1" });
    const client = fakeSocket();
    client.data.userId = "user-1";

    await gateway.handleJoinList(client, "l1");

    expect(client.join).toHaveBeenCalledWith("list:l1");
  });

  it("lets an editor (ListMember) join while social is enabled", async () => {
    const gateway = make({ ownerId: "owner", member: true });
    const client = fakeSocket();
    client.data.userId = "editor";

    await gateway.handleJoinList(client, "l1");

    expect(client.join).toHaveBeenCalledWith("list:l1");
  });

  it("refuses a stranger with no membership", async () => {
    const gateway = make({ ownerId: "owner", member: false });
    const client = fakeSocket();
    client.data.userId = "stranger";

    await gateway.handleJoinList(client, "l1");

    expect(client.join).not.toHaveBeenCalled();
  });

  it("refuses membership-based access once social is disabled (defensive gate)", async () => {
    const gateway = make({
      ownerId: "owner",
      member: true,
      socialEnabled: false,
    });
    const client = fakeSocket();
    client.data.userId = "editor";

    await gateway.handleJoinList(client, "l1");

    expect(client.join).not.toHaveBeenCalled();
  });

  it("refuses joining an unauthenticated socket", async () => {
    const gateway = make({ ownerId: "owner" });
    const client = fakeSocket();

    await gateway.handleJoinList(client, "l1");

    expect(client.join).not.toHaveBeenCalled();
  });
});
