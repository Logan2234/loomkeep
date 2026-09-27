import type { LicenseStatusDto } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminService } from "./admin.service";

function makeService(
  env: Record<string, string>,
  smtpReachable = true,
  callRows: { provider: string; day: Date; count: number }[] = [],
  licenseStatus: LicenseStatusDto | null = null,
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
  const entitlements = {
    getLicenseStatus: vi.fn().mockReturnValue(licenseStatus),
  } as unknown as EntitlementService;
  return {
    service: new AdminService(config, mail, prisma, entitlements),
    mail,
  };
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
      // A code the client translates, where this used to be French prose the
      // API phrased itself.
      failure: "missingKey",
    });
    expect(tmdb?.detail).toBeUndefined();
    // AniList, Open Library and MusicBrainz are keyless, so they are still
    // probed; but no keyed probe ran here.
    expect(global.fetch).toHaveBeenCalledTimes(3);
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

    expect(tmdb).toMatchObject({
      configured: true,
      reachable: false,
      detail: "HTTP 401",
    });
  });

  it("treats a thrown probe (network error / timeout) as down", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("boom")) as unknown as typeof fetch;
    const { service } = makeService({ TMDB_API_TOKEN: "tok" });

    const { services } = await service.getServicesStatus();
    const tmdb = services.find((s) => s.key === "tmdb");

    expect(tmdb).toMatchObject({ reachable: false, detail: "boom" });
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
    expect(smtp).toMatchObject({
      configured: true,
      reachable: false,
      failure: "refused",
    });
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

  it("reports Unleash, Turnstile, GlitchTip (API/Web) and Quackback as presence-only", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService({
      UNLEASH_API_URL: "http://unleash:4242/api",
      UNLEASH_API_TOKEN: "tok",
      TURNSTILE_SECRET_KEY: "secret",
      GLITCHTIP_API_DSN: "https://dsn.example/api",
      QUACKBACK_API_KEY: "qb-key",
    });

    const { services } = await service.getServicesStatus();

    expect(services.find((s) => s.key === "unleash")).toMatchObject({
      configured: true,
      reachable: null,
    });
    expect(services.find((s) => s.key === "turnstile")).toMatchObject({
      configured: true,
      reachable: null,
    });
    expect(services.find((s) => s.key === "glitchtipApi")).toMatchObject({
      configured: true,
      reachable: null,
    });
    expect(services.find((s) => s.key === "glitchtipWeb")).toMatchObject({
      configured: false,
      reachable: null,
    });
    expect(services.find((s) => s.key === "quackback")).toMatchObject({
      configured: true,
      reachable: null,
    });
  });

  it("reports the backup encryption key as required when absent", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService({});

    const { services } = await service.getServicesStatus();
    const backup = services.find((s) => s.key === "backupEncryption");

    expect(backup).toMatchObject({
      required: true,
      configured: false,
      failure: "missingKey",
    });
  });

  it("reports the license as unconfigured (not invalid) when no key is set", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService({});

    const { services } = await service.getServicesStatus();
    const license = services.find((s) => s.key === "license");

    expect(license).toMatchObject({ configured: false, failure: undefined });
    expect(license?.license).toBeUndefined();
  });

  it("reports the license as invalid when the key doesn't verify", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    // EntitlementService.getLicenseStatus() mirrors ee/licensing's own
    // signature check — a null result with a key present means invalid.
    const { service } = makeService(
      { LOOMKEEP_LICENSE_KEY: "garbage" },
      true,
      [],
      null,
    );

    const { services } = await service.getServicesStatus();
    const license = services.find((s) => s.key === "license");

    expect(license).toMatchObject({ configured: false, failure: "invalid" });
  });

  it("reports a valid license with its licensee, expiry and scope", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService(
      { LOOMKEEP_LICENSE_KEY: "valid-key" },
      true,
      [],
      {
        licensee: "Logan",
        expiresAt: "2027-01-01T00:00:00.000Z",
        instanceWide: true,
        current: true,
      },
    );

    const { services } = await service.getServicesStatus();
    const license = services.find((s) => s.key === "license");

    expect(license).toMatchObject({
      configured: true,
      failure: undefined,
      license: {
        licensee: "Logan",
        expiresAt: "2027-01-01T00:00:00.000Z",
        instanceWide: true,
        current: true,
      },
    });
  });

  it("counts configured Healthchecks.io ping URLs out of the total jobs", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService({
      HEALTHCHECKS_BACKUP_URL: "https://hc-ping.com/one",
      HEALTHCHECKS_REPORTS_DIGEST_URL: "https://hc-ping.com/two",
    });

    const { services } = await service.getServicesStatus();
    const healthchecks = services.find((s) => s.key === "healthchecks");

    expect(healthchecks).toMatchObject({
      configured: true,
      reachable: null,
      partial: { configured: 2, total: 9 },
    });
  });

  it("reports Healthchecks.io as unconfigured when no job has a ping URL", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { service } = makeService({});

    const { services } = await service.getServicesStatus();
    const healthchecks = services.find((s) => s.key === "healthchecks");

    expect(healthchecks).toMatchObject({
      configured: false,
      partial: { configured: 0, total: 9 },
    });
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
