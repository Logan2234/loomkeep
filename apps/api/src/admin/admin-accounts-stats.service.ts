import { Injectable } from "@nestjs/common";
import type {
  AdminAccountsSectionDto,
  AdminNewAccountsTrendDto,
  ProfileAccess,
  TrendPeriod,
} from "@loomkeep/shared";
import { DORMANT_AFTER_DAYS } from "@loomkeep/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  cohortMonthStarts,
  cohortRetention,
  enabledDomainCountBuckets,
  type CohortUser,
} from "./admin-accounts-stats.util";
import { bucketize, trendBucketStarts } from "./admin-stats.util";

/** Default bucket size of the "Nouveaux comptes" card before the user picks one. */
const DEFAULT_PERIOD: TrendPeriod = "week";

const DAY_MS = 24 * 60 * 60 * 1000;

const DORMANT_AFTER_MS = DORMANT_AFTER_DAYS * DAY_MS;

/**
 * "Comptes & engagement" section of /admin/stats.
 *
 * Activity is read from `RefreshToken.lastUsedAt` rather than `ActivityEvent`:
 * events only exist since P4, so any account older than that would look dead.
 * A session's `lastUsedAt` is bumped on every refresh rotation, which makes it
 * the one signal that spans the whole history of the instance.
 */
@Injectable()
export class AdminAccountsStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminAccountsSectionDto> {
    const now = new Date();
    const [
      total,
      newAccounts,
      cohorts,
      byEnabledDomainCount,
      byProfileAccess,
      health,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.getNewAccountsTrend(DEFAULT_PERIOD, now),
      this.cohorts(now),
      this.enabledDomains(),
      this.profileAccess(),
      this.health(now),
    ]);

    return {
      generatedAt: now.toISOString(),
      total,
      newAccounts,
      cohorts,
      byEnabledDomainCount,
      byProfileAccess,
      health,
    };
  }

  /** Registration curve at one bucket size — the card's period picker re-queries this alone. */
  async getNewAccountsTrend(
    period: TrendPeriod,
    now = new Date(),
  ): Promise<AdminNewAccountsTrendDto> {
    const starts = trendBucketStarts(period, now);
    const [created, totalAccounts] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: starts[0] } },
        select: { createdAt: true },
      }),
      this.prisma.user.count(),
    ]);

    const points = bucketize(
      created.map((u) => u.createdAt),
      starts,
    );

    return {
      period,
      points,
      totalAccounts,
      delta: points[points.length - 1]?.count ?? 0,
    };
  }

  /** Rolling window of signup-month cohorts, oldest first (the table's staircase). */
  private async cohorts(
    now: Date,
  ): Promise<AdminAccountsSectionDto["cohorts"]> {
    const months = cohortMonthStarts(now);
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: months[0] } },
      select: {
        createdAt: true,
        // Only the freshest session matters: it is the account's "last seen".
        refreshTokens: {
          select: { lastUsedAt: true },
          orderBy: { lastUsedAt: "desc" },
          take: 1,
        },
      },
    });

    const cohortUsers: CohortUser[] = users.map((u) => ({
      createdAt: u.createdAt,
      lastActiveAt: u.refreshTokens[0]?.lastUsedAt ?? null,
    }));

    return cohortRetention(cohortUsers, months);
  }

  private async enabledDomains(): Promise<
    AdminAccountsSectionDto["byEnabledDomainCount"]
  > {
    const users = await this.prisma.user.findMany({
      select: { enabledDomains: true },
    });
    return enabledDomainCountBuckets(users);
  }

  private async profileAccess(): Promise<
    AdminAccountsSectionDto["byProfileAccess"]
  > {
    const rows = await this.prisma.user.groupBy({
      by: ["profileAccess"],
      _count: { _all: true },
    });
    return rows
      .map((r) => ({
        access: r.profileAccess as ProfileAccess,
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private async health(now: Date): Promise<AdminAccountsSectionDto["health"]> {
    const activeSince = (ms: number) =>
      this.prisma.user.count({
        where: {
          refreshTokens: {
            some: { lastUsedAt: { gte: new Date(now.getTime() - ms) } },
          },
        },
      });

    const dormantCutoff = new Date(now.getTime() - DORMANT_AFTER_MS);
    const [
      active24h,
      active30d,
      dormant,
      activeSessions,
      emailVerified,
      withPush,
    ] = await Promise.all([
      activeSince(DAY_MS),
      activeSince(30 * DAY_MS),
      // `none` also catches accounts that never opened a session at all.
      this.prisma.user.count({
        where: {
          refreshTokens: { none: { lastUsedAt: { gte: dormantCutoff } } },
        },
      }),
      this.prisma.refreshToken.count({ where: { expiresAt: { gt: now } } }),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { pushSubscriptions: { some: {} } } }),
    ]);

    return {
      active24h,
      active30d,
      dormant,
      activeSessions,
      emailVerified,
      withPush,
    };
  }
}
