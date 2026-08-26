import type { AdminSystemSectionDto } from "@loomkeep/shared";
import { SecurityEventType } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { startOfUtcDay } from "./admin-stats.util";
import { providerCallRows } from "./admin-system-stats.util";
import { AdminService } from "./admin.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Système" section of /admin/stats: what the instance costs to run. Every
 * figure here is a live snapshot — none of it is historised (see the
 * admin-panel-idea memory for why).
 */
@Injectable()
export class AdminSystemStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
  ) {}

  async getStats(): Promise<AdminSystemSectionDto> {
    const now = new Date();
    const [providerCalls, ops] = await Promise.all([
      this.providerCalls(now),
      this.ops(now),
    ]);

    return {
      generatedAt: now.toISOString(),
      providerCalls,
      ops,
    };
  }

  private async providerCalls(
    now: Date,
  ): Promise<AdminSystemSectionDto["providerCalls"]> {
    const rows = await this.prisma.apiCallCounter.findMany({
      where: { day: startOfUtcDay(now) },
      select: { provider: true, count: true },
    });

    return providerCallRows(
      new Map(rows.map((r) => [r.provider, r.count])),
      this.admin.getProviderQuotaSpecs(),
    );
  }

  private async ops(now: Date): Promise<AdminSystemSectionDto["ops"]> {
    const [
      notificationsPending,
      pushSubscriptions,
      failedLogins24h,
      lastBackup,
    ] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.pushSubscription.count(),
      this.prisma.securityEvent.count({
        where: {
          type: SecurityEventType.LOGIN_FAILED,
          createdAt: { gte: new Date(now.getTime() - DAY_MS) },
        },
      }),
      this.prisma.backupFile.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, sizeBytes: true },
      }),
    ]);

    return {
      notificationsPending,
      pushSubscriptions,
      failedLogins24h,
      lastBackup: lastBackup
        ? {
            createdAt: lastBackup.createdAt.toISOString(),
            sizeBytes: lastBackup.sizeBytes,
          }
        : null,
    };
  }
}
