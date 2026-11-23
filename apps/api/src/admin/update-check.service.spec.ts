import { DEFAULT_INSTANCE_SETTINGS } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi, type Mock } from "vitest";
import { setStoredInstanceSettings } from "../instance-settings/instance-settings.store";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { AdminAlertService } from "../notifications/admin-alert.service";
import type { PrismaService } from "../prisma/prisma.service";
import {
  INSTANCE_PING_URL,
  isNewerVersion,
  LATEST_PACKAGE_URL,
  UpdateCheckService,
} from "./update-check.service";

const { version: CURRENT } = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
) as { version: string };
const [major, minor] = CURRENT.split(".").map(Number);
const NEWER = `${major}.${minor + 1}.0`;

function make(
  row: Record<string, unknown> | null = null,
  env: Record<string, string> = {},
) {
  let stored = row;
  const prisma = {
    updateCheck: {
      findUnique: vi.fn(async () => stored),
      upsert: vi.fn(async ({ create, update }) => {
        stored = { ...(stored ?? create), ...update };
        return stored;
      }),
      update: vi.fn(async ({ data }) => {
        stored = { ...stored, ...data };
        return stored;
      }),
    },
  } as unknown as PrismaService;
  const adminAlerts = {
    notify: vi.fn().mockResolvedValue(1),
  } as unknown as AdminAlertService;
  const service = new UpdateCheckService(
    prisma,
    { get: (key: string) => env[key] } as unknown as ConfigService,
    {} as MailService,
    adminAlerts,
    {} as JobRunService,
  );
  return { service, prisma, adminAlerts };
}

function publish(version: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ version }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("isNewerVersion", () => {
  it.each([
    ["1.12.0", "1.11.9", true],
    ["2.0.0", "1.99.99", true],
    ["1.11.1", "1.11.0", true],
    ["1.11.0", "1.11.0", false],
    ["1.10.5", "1.11.0", false],
    ["v1.12.0", "1.11.0", false],
  ])("%s after %s: %s", (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });
});

/** The hosted instance answering the ping, GitHub answering the fallback. */
function serve({ ping, published }: { ping?: string; published: string }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === INSTANCE_PING_URL) {
      if (ping === undefined) throw new Error("offline");
      return { ok: true, json: async () => ({ latestVersion: ping }) };
    }

    return { ok: true, json: async () => ({ version: published }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function pingCalls(fetchMock: Mock) {
  return fetchMock.mock.calls.filter(([url]) => url === INSTANCE_PING_URL);
}

describe("UpdateCheckService.check", () => {
  beforeEach(() =>
    setStoredInstanceSettings({
      ...DEFAULT_INSTANCE_SETTINGS,
      telemetryEnabled: false,
    }),
  );
  afterEach(() => vi.unstubAllGlobals());

  it("reads the version on main and flags a newer one", async () => {
    const fetchMock = publish(NEWER);
    const { service } = make();

    const status = await service.check();

    expect(fetchMock).toHaveBeenCalledWith(
      LATEST_PACKAGE_URL,
      expect.anything(),
    );
    expect(status).toMatchObject({
      enabled: true,
      currentVersion: CURRENT,
      latestVersion: NEWER,
      updateAvailable: true,
      lastCheckFailed: false,
    });
  });

  it("emails the administrators once per new version", async () => {
    publish(NEWER);
    const { service, adminAlerts } = make();

    await service.check();
    await service.check();

    expect(adminAlerts.notify).toHaveBeenCalledTimes(1);
    expect((adminAlerts.notify as Mock).mock.calls[0][0]).toBe(
      "ADMIN_UPDATE_AVAILABLE",
    );
  });

  it("says nothing when the instance already runs the published version", async () => {
    publish(CURRENT);
    const { service, adminAlerts } = make();

    await expect(service.check()).resolves.toMatchObject({
      updateAvailable: false,
    });
    expect(adminAlerts.notify).not.toHaveBeenCalled();
  });

  it("keeps the last result and flags the failure when GitHub can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { service } = make({
      latestVersion: NEWER,
      checkedAt: new Date("2026-10-19T05:30:00Z"),
      lastCheckFailed: false,
      notifiedVersion: NEWER,
    });

    await expect(service.check()).resolves.toMatchObject({
      latestVersion: NEWER,
      checkedAt: "2026-10-19T05:30:00.000Z",
      lastCheckFailed: true,
    });
  });

  it("sends no request at all once the check is turned off", async () => {
    const fetchMock = publish(NEWER);
    setStoredInstanceSettings({
      ...DEFAULT_INSTANCE_SETTINGS,
      updateCheckEnabled: false,
    });
    const { service } = make();

    await expect(service.check()).resolves.toMatchObject({ enabled: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("UpdateCheckService.check with telemetry", () => {
  beforeEach(() => setStoredInstanceSettings(DEFAULT_INSTANCE_SETTINGS));
  afterEach(() => vi.unstubAllGlobals());

  it("sends only a random id and the version, and takes the answer as the latest version", async () => {
    const fetchMock = serve({ ping: NEWER, published: CURRENT });
    const { service } = make();

    await expect(service.check()).resolves.toMatchObject({
      latestVersion: NEWER,
      lastCheckFailed: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [[url, init]] = fetchMock.mock.calls as unknown as [
      [string, RequestInit],
    ];
    expect(url).toBe(INSTANCE_PING_URL);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["instanceId", "version"]);
    expect(body.version).toBe(CURRENT);
    expect(body.instanceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("keeps the same instance id from one check to the next", async () => {
    const fetchMock = serve({ ping: CURRENT, published: CURRENT });
    const { service } = make();

    await service.check();
    await service.check();

    const ids = pingCalls(fetchMock).map(
      ([, init]) => JSON.parse((init as RequestInit).body as string).instanceId,
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("falls back to the version on GitHub when the hosted instance can't answer", async () => {
    const fetchMock = serve({ published: NEWER });
    const { service } = make();

    await expect(service.check()).resolves.toMatchObject({
      latestVersion: NEWER,
      lastCheckFailed: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      LATEST_PACKAGE_URL,
      expect.anything(),
    );
  });

  it.each([
    ["the hosted instance", { WEB_ORIGIN: "https://loomkeep.app" }],
    ["a dev run", { NODE_ENV: "development" }],
    ["a test run", { NODE_ENV: "test" }],
  ])("never pings from %s", async (_, env) => {
    const fetchMock = serve({ ping: CURRENT, published: NEWER });
    const { service } = make(null, env);

    await expect(service.check()).resolves.toMatchObject({
      latestVersion: NEWER,
    });
    expect(pingCalls(fetchMock)).toHaveLength(0);
  });

  it("sends nothing at all once the update check is off", async () => {
    const fetchMock = serve({ ping: CURRENT, published: CURRENT });
    setStoredInstanceSettings({
      ...DEFAULT_INSTANCE_SETTINGS,
      updateCheckEnabled: false,
    });
    const { service, prisma } = make();

    await service.check();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.updateCheck.upsert).not.toHaveBeenCalled();
  });
});

describe("UpdateCheckService.upgradeNotes", () => {
  const CHANGELOG = `## ${NEWER} — Next\n\n### Breaking changes\n\n- Rename \`X\`.\n`;

  function serveChangelog() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => CHANGELOG,
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("reads the CHANGELOG once for a newer version", async () => {
    setStoredInstanceSettings(DEFAULT_INSTANCE_SETTINGS);
    const fetchMock = serveChangelog();
    const { service } = make({ id: 1, latestVersion: NEWER });

    await expect(service.upgradeNotes()).resolves.toEqual({
      versions: [{ version: NEWER, items: ["Rename `X`."] }],
    });
    await service.upgradeNotes();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends no request once the check is turned off", async () => {
    setStoredInstanceSettings({
      ...DEFAULT_INSTANCE_SETTINGS,
      updateCheckEnabled: false,
    });
    const fetchMock = serveChangelog();
    const { service } = make({ id: 1, latestVersion: NEWER });

    await expect(service.upgradeNotes()).resolves.toEqual({ versions: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
