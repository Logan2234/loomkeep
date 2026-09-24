import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { vi, type Mock } from "vitest";
import { registerRequestContext } from "../common/request-context";
import type { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "./security-event.service";

function makeService() {
  const prisma = {
    securityEvent: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as PrismaService;

  return { service: new SecurityEventService(prisma), prisma };
}

describe("SecurityEventService.record", () => {
  it("persists the event, defaulting a missing userId to null", async () => {
    const { service, prisma } = makeService();

    await service.record({
      type: "LOGIN_FAILED",
      identifier: "nobody@example.com",
    });

    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "LOGIN_FAILED",
        userId: null,
        identifier: "nobody@example.com",
        detail: undefined,
        userAgent: undefined,
        ip: undefined,
      },
    });
  });

  it("takes the IP, and the user agent unless given, from the request being handled", async () => {
    const { service, prisma } = makeService();
    const handleRequest = captureRequestHook();

    await new Promise<void>((resolve) =>
      handleRequest(
        { ip: "203.0.113.7", headers: { "user-agent": "Firefox" } },
        () => void service.record({ type: "PASSWORD_CHANGED" }).then(resolve),
      ),
    );

    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ip: "203.0.113.7",
        userAgent: "Firefox",
      }),
    });
  });
});

/** The request hook `registerRequestContext` installs, called by hand. */
function captureRequestHook() {
  let hook: (
    request: { ip: string; headers: Record<string, string> },
    reply: unknown,
    done: () => void,
  ) => void = () => undefined;
  const app = {
    getHttpAdapter: () => ({
      getInstance: () => ({
        addHook: (_name: string, fn: typeof hook) => (hook = fn),
      }),
    }),
  } as unknown as NestFastifyApplication;

  registerRequestContext(app);
  return (
    request: { ip: string; headers: Record<string, string> },
    done: () => void,
  ) => hook(request, {}, done);
}

describe("SecurityEventService.listForAccount", () => {
  it("reads only the account's own events, newest first, without USER_DELETED", async () => {
    const { service, prisma } = makeService();

    await service.listForAccount("user-1", 2, 20);

    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: { not: "USER_DELETED" } },
      orderBy: { createdAt: "desc" },
      skip: 20,
      take: 21,
    });
  });

  it("hands back the IP and never the identifier typed at a failed login", async () => {
    const { service, prisma } = makeService();
    (prisma.securityEvent.findMany as Mock).mockResolvedValue([
      {
        id: "e1",
        type: "LOGIN_FAILED",
        userId: "user-1",
        identifier: "alice",
        detail: null,
        userAgent: "Firefox",
        ip: "203.0.113.7",
        createdAt: new Date("2026-09-24T10:00:00Z"),
      },
    ]);

    const result = await service.listForAccount("user-1", 1, 20);

    expect(result).toEqual({
      hasMore: false,
      items: [
        {
          id: "e1",
          type: "LOGIN_FAILED",
          detail: null,
          ip: "203.0.113.7",
          userAgent: "Firefox",
          createdAt: "2026-09-24T10:00:00.000Z",
        },
      ],
    });
  });
});

describe("SecurityEventService.forgetIps", () => {
  it("erases the account's IPs, except on failed logins", async () => {
    const { service, prisma } = makeService();

    await service.forgetIps("user-1");

    expect(prisma.securityEvent.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: { not: "LOGIN_FAILED" } },
      data: { ip: null },
    });
  });
});

describe("SecurityEventService.purgeExpired", () => {
  it("deletes every event older than a year", async () => {
    const { service, prisma } = makeService();

    await service.purgeExpired(new Date("2026-09-24T06:00:00Z"));

    expect(prisma.securityEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2025-09-24T06:00:00Z") } },
    });
  });
});

describe("SecurityEventService.list", () => {
  it("defaults to page 1 and filters by type + a case-insensitive match on either the stored identifier or the linked account's email", async () => {
    const { service, prisma } = makeService();

    await service.list({ type: "USER_DELETED", identifier: "Alice" });

    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "USER_DELETED",
          OR: [
            { identifier: { contains: "Alice", mode: "insensitive" } },
            { user: { email: { contains: "Alice", mode: "insensitive" } } },
          ],
        },
        skip: 0,
        take: 51,
      }),
    );
  });

  it("pages by 50, offsetting by (page - 1) * 50", async () => {
    const { service, prisma } = makeService();

    await service.list({ page: 3 });

    // take is limit + 1 (over-fetch by one to derive hasMore).
    expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 51 }),
    );
  });

  it("derives the display identifier from the linked account's email once the raw identifier is gone", async () => {
    const { service, prisma } = makeService();
    (prisma.securityEvent.findMany as Mock).mockResolvedValue([
      {
        id: "e1",
        type: "PASSWORD_CHANGED",
        userId: "u1",
        identifier: null,
        user: { email: "a@b.com" },
        detail: null,
        userAgent: null,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "e2",
        type: "USER_DELETED",
        userId: null,
        identifier: null,
        user: null,
        detail: null,
        userAgent: null,
        createdAt: new Date("2026-01-02"),
      },
    ]);

    const { items } = await service.list({});

    expect(items[0].identifier).toBe("a@b.com");
    expect(items[1].identifier).toBeNull();
  });
});
