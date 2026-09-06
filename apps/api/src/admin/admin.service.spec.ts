import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminService } from "./admin.service";

function makeService(
  env: Record<string, string>,
  smtpReachable = true,
  callRows: { provider: string; day: Date; count: number }[] = [],
) {
  const config = {
    get: vi.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  const mail = {
    verifyConnection: vi.fn().mockResolvedValue(smtpReachable),
  } as unknown as MailService;
  const prisma = {
    apiCallCounter: { findMany: vi.fn().mockResolvedValue(callRows) },
  } as unknown as PrismaService;
  return { service: new AdminService(config, mail, prisma), mail };
}

function utcDay(daysAgo: number): Date {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

describe("AdminService.getServicesStatus", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reports an unconfigured keyed service without probing it", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService({}); // no keys set

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({
      configured: false,
      reachable: null,
      detail: "Clé absente",
    });
    // AniList and Open Library are keyless and live, while MusicBrainz is
    // parked and must never be probed.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("marks a configured service healthy on a 2xx probe", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "tok" });

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({ configured: true, reachable: true });
  });

  it("marks a configured service down on a non-2xx probe (rejected key)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "bad" });

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({ configured: true, reachable: false });
  });

  it("treats a thrown probe (network error / timeout) as down", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("boom")) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "tok" });

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb?.reachable).toBe(false);
  });

  it("probes SMTP via MailService.verifyConnection", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service, mail } = makeService(
      { SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" },
      false,
    );

    const { services } = await service.getServicesStatus();
    const smtp = services.find((s) => s.key === "smtp");

    expect(mail.verifyConnection).toHaveBeenCalled();
    expect(smtp).toMatchObject({ configured: true, reachable: false });
  });

  it("reports a configured-but-unprobed service (VAPID) as reachable:null", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service } = makeService({
      VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: "priv",
    });

    const { services } = await service.getServicesStatus();
    const push = services.find((s) => s.key === "webPush");

    expect(push).toMatchObject({ configured: true, reachable: null });
  });
});

describe("AdminService.getServicesStatus — quota aggregation", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sums today/this-month for a service with a documented limit and computes percentUsed", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService({}, true, [
      { provider: "omdb", day: utcDay(0), count: 800 },
      { provider: "omdb", day: utcDay(3), count: 100 },
    ]);

    const { services } = await service.getServicesStatus();
    const omdb = services.find((s) => s.key === "omdb");

    expect(omdb).toMatchObject({
      today: 800,
      thisMonth: 900,
      limit: { max: 1000, window: "day" },
      percentUsed: 80,
    });
  });

  it("reports today/thisMonth without a limit for a service with no documented quota", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "tok" }, true, [
      { provider: "tmdb", day: utcDay(0), count: 5 },
    ]);

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({ today: 5, thisMonth: 5 });
    expect(tmdb?.limit).toBeUndefined();
    expect(tmdb?.percentUsed).toBeUndefined();
  });

  it("never attaches quota fields to webPush (no outbound calls)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const { service } = makeService({
      VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: "priv",
    });

    const { services } = await service.getServicesStatus();
    const push = services.find((s) => s.key === "webPush");

    expect(push?.today).toBeUndefined();
    expect(push?.thisMonth).toBeUndefined();
  });
});
