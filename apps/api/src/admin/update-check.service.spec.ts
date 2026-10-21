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
  isNewerVersion,
  LATEST_PACKAGE_URL,
  UpdateCheckService,
} from "./update-check.service";

const { version: CURRENT } = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
) as { version: string };
const [major, minor] = CURRENT.split(".").map(Number);
const NEWER = `${major}.${minor + 1}.0`;

function make(row: Record<string, unknown> | null = null) {
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
    { get: () => undefined } as unknown as ConfigService,
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

describe("UpdateCheckService.check", () => {
  beforeEach(() => setStoredInstanceSettings(DEFAULT_INSTANCE_SETTINGS));
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
