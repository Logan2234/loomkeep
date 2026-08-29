import type {
  AdminSecuritySummaryDto,
  PagedResult,
  SecurityEventDto,
  SecurityEventType,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { rankFailedTargets, sinceDaysAgo } from "./login-failure.util";

/** Default events per page on the admin "Sécurité" list. */
export const SECURITY_EVENT_PAGE_SIZE = 50;

/** Window the "most targeted identifiers" ranking looks back over, in days. */
const TARGETS_WINDOW_DAYS = 7;

export interface RecordSecurityEventParams {
  type: SecurityEventType;
  /** Null when the account is unknown (e.g. a LOGIN_FAILED against an unregistered identifier). */
  userId?: string | null;
  /** Only meaningful for LOGIN_FAILED (the string actually typed) — every other type derives its display email from userId at read time, so pass nothing. */
  identifier?: string;
  detail?: string;
  userAgent?: string;
}

export interface ListSecurityEventsParams {
  type?: SecurityEventType;
  /** Matches either the stored identifier (LOGIN_FAILED) or the linked account's current email. */
  identifier?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SecurityEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordSecurityEventParams): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        type: params.type,
        userId: params.userId ?? null,
        identifier: params.identifier,
        detail: params.detail,
        userAgent: params.userAgent,
      },
    });
  }

  /**
   * Failed-login pressure over three trailing windows, for the header of the
   * admin "Sécurité" page. Only LOGIN_FAILED: the other event types are
   * deliberate account actions that read fine as a chronological list, whereas
   * failed logins only mean something as a rate. The ranking is what makes the
   * counts actionable — a hundred failures spread over every account is noise,
   * a hundred against one identifier is an attack.
   */
  async summary(now = new Date()): Promise<AdminSecuritySummaryDto> {
    const type: SecurityEventType = "LOGIN_FAILED";
    const [total, last24h, last7d, last30d, byIdentifier] = await Promise.all([
      this.prisma.securityEvent.count({ where: { type } }),
      this.countFailedSince(sinceDaysAgo(now, 1)),
      this.countFailedSince(sinceDaysAgo(now, 7)),
      this.countFailedSince(sinceDaysAgo(now, 30)),
      this.prisma.securityEvent.groupBy({
        by: ["identifier"],
        where: {
          type,
          createdAt: { gte: sinceDaysAgo(now, TARGETS_WINDOW_DAYS) },
        },
        _count: { _all: true },
      }),
    ]);

    return {
      loginFailedTotal: total,
      loginFailed24h: last24h,
      loginFailed7d: last7d,
      loginFailed30d: last30d,
      topTargets7d: rankFailedTargets(
        byIdentifier
          // LOGIN_FAILED always writes identifier (see #record) — filter is
          // just to satisfy the now-nullable column's type.
          .filter(
            (row): row is typeof row & { identifier: string } =>
              row.identifier !== null,
          )
          .map((row) => ({
            identifier: row.identifier,
            failures: row._count._all,
          })),
      ),
    };
  }

  private countFailedSince(since: Date): Promise<number> {
    return this.prisma.securityEvent.count({
      where: { type: "LOGIN_FAILED", createdAt: { gte: since } },
    });
  }

  async list(
    params: ListSecurityEventsParams,
  ): Promise<PagedResult<SecurityEventDto>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0
        ? params.limit
        : SECURITY_EVENT_PAGE_SIZE;

    const rows = await this.prisma.securityEvent.findMany({
      where: {
        type: params.type,
        ...(params.identifier
          ? {
              OR: [
                {
                  identifier: {
                    contains: params.identifier,
                    mode: "insensitive",
                  },
                },
                {
                  user: {
                    email: { contains: params.identifier, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit);

    return {
      hasMore,
      items: events.map((e) => ({
        id: e.id,
        type: e.type as SecurityEventType,
        userId: e.userId,
        identifier: e.identifier ?? e.user?.email ?? null,
        detail: e.detail,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
