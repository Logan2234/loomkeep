import { Injectable } from "@nestjs/common";
import type {
  AdminSystemSectionDto,
  AdminTableSizeDto,
} from "@tracklore/shared";
import { SecurityEventType } from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AdminService } from "./admin.service";
import { startOfUtcDay } from "./admin-stats.util";
import {
  providerCallRows,
  shareOrNull,
  TOP_TABLES_LIMIT,
} from "./admin-system-stats.util";

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
    const [sizes, providerCalls, ops] = await Promise.all([
      this.tableSizes(),
      this.providerCalls(now),
      this.ops(now),
    ]);

    return {
      generatedAt: now.toISOString(),
      // Summed here rather than re-queried: the per-table rows already cover
      // the whole schema, so a second SUM() would only be a chance to disagree.
      databaseBytes: sizes.reduce((sum, t) => sum + t.bytes, 0),
      tables: sizes.slice(0, TOP_TABLES_LIMIT),
      providerCalls,
      ops,
    };
  }

  /** Every table of the current schema with its on-disk size (data + indexes), heaviest first. */
  private async tableSizes(): Promise<AdminTableSizeDto[]> {
    const rows = await this.prisma.$queryRaw<
      { table: string; bytes: bigint }[]
    >`
      SELECT tablename::text AS "table",
             pg_total_relation_size(quote_ident(tablename))::bigint AS bytes
      FROM pg_tables
      WHERE schemaname = current_schema()
      ORDER BY bytes DESC
    `;
    return rows.map((r) => ({ table: r.table, bytes: Number(r.bytes) }));
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
      notifications,
      notificationsRead,
      pushSubscriptions,
      failedLogins24h,
      lastBackup,
    ] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { readAt: { not: null } } }),
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
      notificationReadPercent: shareOrNull(notificationsRead, notifications),
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
