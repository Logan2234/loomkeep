import type { AdminSelfHostedInstancesDto } from "@loomkeep/shared/contracts";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sinceDaysAgo } from "../common/date.util";
import { isHostedOrigin } from "../common/instance-defaults";
import { primaryWebOrigin } from "../common/web-origin.util";
import { PrismaService } from "../prisma/prisma.service";
import type { InstancePingRequestDto } from "./dto/instance-ping-request.dto";
import { isNewerVersion, UpdateCheckService } from "./update-check.service";

const ACTIVE_DAYS = 30;
// Disclosed in apps/docs (self-hosting/telemetry): change both together.
const RETENTION_DAYS = 90;

/**
 * The receiving end of UpdateCheckService's telemetry ping. Only the hosted
 * instance receives: on a self-host the route answers 404 and the count is
 * null.
 */
@Injectable()
export class InstancePingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly updateCheck: UpdateCheckService,
  ) {}

  isReceiver(): boolean {
    return isHostedOrigin(
      primaryWebOrigin(this.config.get<string>("WEB_ORIGIN")),
    );
  }

  /** Records the ping and answers the latest version, as the update check expects. */
  async record({
    instanceId,
    version,
  }: InstancePingRequestDto): Promise<string> {
    const now = new Date();
    // Purged here rather than by a job of its own, which every self-host
    // would list in Admin › Jobs for a table only the hosted instance fills.
    await this.prisma.$transaction([
      this.prisma.instancePing.upsert({
        where: { instanceId },
        create: { instanceId, version, firstSeenAt: now, lastSeenAt: now },
        update: { version, lastSeenAt: now },
      }),
      this.prisma.instancePing.deleteMany({
        where: { lastSeenAt: { lt: sinceDaysAgo(now, RETENTION_DAYS) } },
      }),
    ]);

    return this.latestVersion();
  }

  async summary(): Promise<AdminSelfHostedInstancesDto | null> {
    if (!this.isReceiver()) return null;

    const rows = await this.prisma.instancePing.groupBy({
      by: ["version"],
      where: { lastSeenAt: { gte: sinceDaysAgo(new Date(), ACTIVE_DAYS) } },
      _count: { _all: true },
    });
    const versions = rows
      .map((row) => ({ version: row.version, instances: row._count._all }))
      .sort((a, b) => b.instances - a.instances);

    return {
      active30d: versions.reduce((total, v) => total + v.instances, 0),
      versions,
    };
  }

  // The hosted instance is deployed from `main`, so its own version is the
  // latest one unless its update check already saw a newer one published.
  private async latestVersion(): Promise<string> {
    const { currentVersion, latestVersion } = await this.updateCheck.status();
    return latestVersion !== null &&
      isNewerVersion(latestVersion, currentVersion)
      ? latestVersion
      : currentVersion;
  }
}
