import { Injectable } from "@nestjs/common";
import type {
  AdminSecuritySummaryDto,
  SecurityEventDto,
  SecurityEventType,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { rankFailedTargets, sinceDaysAgo } from "./login-failure.util";

/** Events per page on the admin "Sécurité" list. */
const PAGE_SIZE = 50;

/** Window the "most targeted identifiers" ranking looks back over, in days. */
const TARGETS_WINDOW_DAYS = 7;

export interface RecordSecurityEventParams {
  type: SecurityEventType;
  /** Null when the account is unknown (e.g. a LOGIN_FAILED against an unregistered identifier). */
  userId?: string | null;
  identifier: string;
  detail?: string;
  userAgent?: string;
}

export interface ListSecurityEventsParams {
  type?: SecurityEventType;
  /** Case-insensitive partial match against `identifier` — deliberately not limited to current accounts, so it still finds trails left by deleted ones. */
  identifier?: string;
  page?: number;
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
        byIdentifier.map((row) => ({
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
  ): Promise<{ events: SecurityEventDto[]; page: number }> {
    const page = params.page && params.page > 0 ? params.page : 1;

    const events = await this.prisma.securityEvent.findMany({
      where: {
        type: params.type,
        identifier: params.identifier
          ? { contains: params.identifier, mode: "insensitive" }
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    return {
      page,
      events: events.map((e) => ({
        id: e.id,
        type: e.type as SecurityEventType,
        userId: e.userId,
        identifier: e.identifier,
        detail: e.detail,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
