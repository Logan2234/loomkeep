import type { ConfigService } from "@nestjs/config";
import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { InstancePingService } from "./instance-ping.service";
import type { UpdateCheckService } from "./update-check.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const ID = "0b6f3c3e-8d4a-4f7e-9a51-2c1d5e7f9a10";

function make({
  webOrigin = "https://loomkeep.app",
  currentVersion = "1.15.0",
  latestVersion = null as string | null,
  groups = [] as { version: string; _count: { _all: number } }[],
} = {}) {
  const prisma = {
    instancePing: {
      upsert: vi.fn((args) => args),
      deleteMany: vi.fn((args) => args),
      groupBy: vi.fn().mockResolvedValue(groups),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => (key === "WEB_ORIGIN" ? webOrigin : undefined),
  } as unknown as ConfigService;
  const updateCheck = {
    status: vi.fn().mockResolvedValue({ currentVersion, latestVersion }),
  } as unknown as UpdateCheckService;
  return {
    service: new InstancePingService(prisma, config, updateCheck),
    prisma,
  };
}

describe("InstancePingService.record", () => {
  it("stores the id and version alone, and purges ids unseen for 90 days", async () => {
    const { service, prisma } = make();

    await service.record({ instanceId: ID, version: "1.14.0" });

    const [upsert] = (prisma.instancePing.upsert as Mock).mock.calls[0];
    expect(upsert.where).toEqual({ instanceId: ID });
    expect(Object.keys(upsert.create).sort()).toEqual([
      "firstSeenAt",
      "instanceId",
      "lastSeenAt",
      "version",
    ]);
    expect(Object.keys(upsert.update).sort()).toEqual([
      "lastSeenAt",
      "version",
    ]);
    const [purge] = (prisma.instancePing.deleteMany as Mock).mock.calls[0];
    const cutoff = purge.where.lastSeenAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeCloseTo(90 * DAY_MS, -4);
  });

  it("answers its own version, the one `main` is deployed at", async () => {
    const { service } = make({ currentVersion: "1.15.0" });

    await expect(
      service.record({ instanceId: ID, version: "1.14.0" }),
    ).resolves.toBe("1.15.0");
  });

  it("answers a newer published version its update check already saw", async () => {
    const { service } = make({
      currentVersion: "1.15.0",
      latestVersion: "1.15.1",
    });

    await expect(
      service.record({ instanceId: ID, version: "1.14.0" }),
    ).resolves.toBe("1.15.1");
  });
});

describe("InstancePingService.summary", () => {
  it("is null on a self-host, which receives no ping", async () => {
    const { service, prisma } = make({ webOrigin: "https://media.example" });

    expect(service.isReceiver()).toBe(false);
    await expect(service.summary()).resolves.toBeNull();
    expect(prisma.instancePing.groupBy).not.toHaveBeenCalled();
  });

  it("counts the instances seen in the last 30 days, by version", async () => {
    const { service, prisma } = make({
      groups: [
        { version: "1.14.0", _count: { _all: 2 } },
        { version: "1.15.0", _count: { _all: 5 } },
      ],
    });

    await expect(service.summary()).resolves.toEqual({
      active30d: 7,
      versions: [
        { version: "1.15.0", instances: 5 },
        { version: "1.14.0", instances: 2 },
      ],
    });
    const [args] = (prisma.instancePing.groupBy as Mock).mock.calls[0];
    const since = args.where.lastSeenAt.gte as Date;
    expect(Date.now() - since.getTime()).toBeCloseTo(30 * DAY_MS, -4);
  });
});
