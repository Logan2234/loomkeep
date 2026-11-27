import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  type AdminUserDetailDto,
  type AdminUserDto,
  type AdminUserLibraryCountsDto,
  type AdminUserRecentAdditionDto,
  type AdminUserSort,
} from "@loomkeep/shared/contracts";
import { type Domain } from "@loomkeep/shared/enums";
import { HttpStatus, Injectable } from "@nestjs/common";
import { type Plan, Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "../common/external-id.util";
import { effectivePlan } from "../entitlements/entitlement.service";
import { EventsGateway } from "../events/events.gateway";
import { PrismaService } from "../prisma/prisma.service";
import { preferencesOf } from "../users/preferences.util";
import { ageBracket } from "./admin-accounts-stats.util";
import {
  ADMIN_USER_INCLUDE,
  type AdminUserRow,
  EMPTY_LIBRARY_COUNTS,
  toAdminUserDto,
} from "./admin-user.mapper";

const RECENT_COUNT = 5;
const SECURITY_EVENT_COUNT = 10;

/** The admin users table's rows and the account page behind each of them. */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * One page of the accounts matching `where`, in the order the table asks
   * for. `take` is the page size plus one, so the caller can tell whether
   * another page follows.
   */
  async page(
    where: Prisma.UserWhereInput,
    sort: AdminUserSort,
    descending: boolean,
    skip: number,
    take: number,
  ): Promise<AdminUserRow[]> {
    if (sort === "created" || sort === "active") {
      const direction = descending ? "desc" : "asc";
      return this.prisma.user.findMany({
        where,
        orderBy: [
          sort === "created"
            ? { createdAt: direction }
            : { lastActiveAt: { sort: direction, nulls: "last" } },
          { id: "asc" },
        ],
        skip,
        take,
        include: ADMIN_USER_INCLUDE,
      });
    }

    // Library size spans four tables and an account may have no score row,
    // which one Prisma orderBy can't express: rank the matching ids here.
    // An admin list stays in the thousands of accounts at most.
    const ids = await this.prisma.user.findMany({
      where,
      select: { id: true, score: { select: { xp: true } } },
    });
    const metric =
      sort === "xp"
        ? new Map(ids.map((u) => [u.id, u.score?.xp ?? 0]))
        : await this.libraryTotals(ids.map((u) => u.id));
    const ranked = ids
      .map((u) => u.id)
      .sort(
        (a, b) =>
          ((metric.get(b) ?? 0) - (metric.get(a) ?? 0)) *
            (descending ? 1 : -1) || a.localeCompare(b),
      )
      .slice(skip, skip + take);

    const rows = await this.prisma.user.findMany({
      where: { id: { in: ranked } },
      include: ADMIN_USER_INCLUDE,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ranked.flatMap((id) => byId.get(id) ?? []);
  }

  /** The table rows for `users`, with what a `User` row alone doesn't hold. */
  async toRows(users: AdminUserRow[]): Promise<AdminUserDto[]> {
    const userIds = users.map((u) => u.id);
    // Most accounts have no entitlement row yet (FREE, see EntitlementService).
    const [entitlements, counts, online] = await Promise.all([
      this.prisma.userEntitlement.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, plan: true, expiresAt: true },
      }),
      this.libraryCounts(userIds),
      this.events.connectedUserIds(),
    ]);
    const entitlementByUserId = new Map(entitlements.map((e) => [e.userId, e]));

    return users.map((u) =>
      toAdminUserDto(u, {
        ...planOf(entitlementByUserId.get(u.id)),
        libraryCounts: counts.get(u.id) ?? EMPTY_LIBRARY_COUNTS,
        online: online.has(u.id),
      }),
    );
  }

  async detail(userId: string, now = new Date()): Promise<AdminUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: ADMIN_USER_INCLUDE,
    });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminAccountNotFound,
      );
    }

    const [
      [row],
      recoveryCodesLeft,
      apiKeys,
      devices,
      pushSubscriptions,
      events,
      imports,
      recentAdditions,
      achievements,
      sharedListMemberships,
      savedViews,
      decisions,
      reportsFiled,
      blocking,
      blockedBy,
    ] = await Promise.all([
      this.toRows([user]),
      this.prisma.mfaRecoveryCode.count({ where: { userId } }),
      this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          suffix: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      }),
      this.prisma.userDevice.findMany({
        where: { userId },
        orderBy: { lastSeenAt: "desc" },
        select: { id: true, userAgent: true, lastSeenAt: true },
      }),
      this.prisma.pushSubscription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, platform: true, userAgent: true, createdAt: true },
      }),
      this.prisma.securityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: SECURITY_EVENT_COUNT,
        select: { id: true, type: true, createdAt: true },
      }),
      this.prisma.importRun.findMany({
        where: { userId },
        orderBy: { finishedAt: "desc" },
        take: RECENT_COUNT,
        select: {
          id: true,
          sourceId: true,
          status: true,
          itemCount: true,
          finishedAt: true,
        },
      }),
      this.recentAdditions(userId),
      this.prisma.userAchievement.count({ where: { userId } }),
      this.prisma.listMember.count({ where: { userId } }),
      this.prisma.savedView.count({ where: { userId } }),
      this.prisma.moderationDecision.findMany({
        where: { subjectUserId: userId },
        orderBy: { decidedAt: "desc" },
        select: {
          id: true,
          measure: true,
          tosClause: true,
          decidedAt: true,
          decidedBy: { select: { displayName: true } },
        },
      }),
      this.prisma.report.count({ where: { reporterId: userId } }),
      this.prisma.block.count({ where: { blockerId: userId } }),
      this.prisma.block.count({ where: { blockedId: userId } }),
    ]);

    const prefs = preferencesOf(user.preferences);
    return {
      user: row,
      journey: {
        onboardedAt: user.onboarding?.onboardedAt?.toISOString() ?? null,
        acquisitionSource: user.onboarding?.acquisitionSource ?? null,
        acquisitionSourceOther: user.onboarding?.acquisitionSourceOther ?? null,
        acceptedTermsVersion: user.consent?.acceptedTermsVersion ?? null,
        acceptedTermsAt: user.consent?.acceptedTermsAt?.toISOString() ?? null,
        ageBracket: user.birthDate ? ageBracket(user.birthDate, now) : null,
      },
      security: {
        passkeys: user._count.webauthnCredentials,
        passwordless: user.passwordlessEnabled,
        recoveryCodesLeft,
        apiKeys: apiKeys.map((k) => ({
          ...k,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
        })),
        devices: devices.map((d) => ({
          ...d,
          lastSeenAt: d.lastSeenAt.toISOString(),
        })),
        pushSubscriptions: pushSubscriptions.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        })),
        events: events.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        })),
      },
      preferences: {
        locale: user.locale,
        timezone: user.timezone,
        watchRegion: prefs.watchRegion,
        watchProviderCount: prefs.watchProviderIds.length,
        notifyEmail: prefs.notifyEmail,
        notifyPush: prefs.notifyPush,
        newsletter: prefs.notifyNewsletter,
        newsletterOptInAt:
          user.consent?.newsletterOptInAt?.toISOString() ?? null,
        profileAccess: user.profileAccess,
        defaultReviewVisibility: prefs.defaultReviewVisibility,
        allowAdultContent: prefs.allowAdultContent,
      },
      imports: imports.map((i) => ({
        ...i,
        finishedAt: i.finishedAt.toISOString(),
      })),
      recentAdditions,
      engagement: { achievements, sharedListMemberships, savedViews },
      moderation: {
        decisions: decisions.map((d) => ({
          id: d.id,
          measure: d.measure,
          tosClause: d.tosClause,
          decidedAt: d.decidedAt.toISOString(),
          decidedByName: d.decidedBy?.displayName ?? null,
        })),
        reportsFiled,
        blocking,
        blockedBy,
      },
    };
  }

  private async libraryCounts(
    userIds: string[],
  ): Promise<Map<string, AdminUserLibraryCountsDto>> {
    const where = { userId: { in: userIds } };
    const [media, games, books, music] = await Promise.all([
      this.prisma.mediaEntry.groupBy({ by: ["userId"], where, _count: true }),
      this.prisma.gameEntry.groupBy({ by: ["userId"], where, _count: true }),
      this.prisma.bookEntry.groupBy({ by: ["userId"], where, _count: true }),
      this.prisma.musicEntry.groupBy({ by: ["userId"], where, _count: true }),
    ]);
    const counts = new Map<string, AdminUserLibraryCountsDto>();

    const add = (
      rows: { userId: string; _count: number }[],
      key: keyof AdminUserLibraryCountsDto,
    ) => {
      for (const r of rows) {
        const current = counts.get(r.userId) ?? { ...EMPTY_LIBRARY_COUNTS };
        current[key] = r._count;
        counts.set(r.userId, current);
      }
    };

    add(media, "media");
    add(games, "games");
    add(books, "books");
    add(music, "music");
    return counts;
  }

  private async libraryTotals(userIds: string[]): Promise<Map<string, number>> {
    const counts = await this.libraryCounts(userIds);
    return new Map(
      [...counts].map(([id, c]) => [id, c.media + c.games + c.books + c.music]),
    );
  }

  private async recentAdditions(
    userId: string,
  ): Promise<AdminUserRecentAdditionDto[]> {
    const recent = {
      where: { userId },
      orderBy: [
        { createdAt: Prisma.SortOrder.desc },
        { id: Prisma.SortOrder.asc },
      ],
      take: RECENT_COUNT,
    };
    const item = {
      select: { title: true, ...CANONICAL_EXTERNAL_ID_SELECT },
    } as const;
    const [media, games, books, music] = await Promise.all([
      this.prisma.mediaEntry.findMany({
        ...recent,
        include: { mediaItem: { select: { ...item.select, type: true } } },
      }),
      this.prisma.gameEntry.findMany({
        ...recent,
        include: { gameItem: item },
      }),
      this.prisma.bookEntry.findMany({
        ...recent,
        include: { bookItem: item },
      }),
      this.prisma.musicEntry.findMany({
        ...recent,
        include: { musicItem: item },
      }),
    ]);

    const toDto = (
      row: { id: string; createdAt: Date },
      work: {
        title: string;
        canonicalSource: string;
        externalIds: { source: string; externalId: string }[];
      },
      domain: Domain,
      base: string,
    ): AdminUserRecentAdditionDto => {
      const sourceId = canonicalExternalId(work, work.externalIds);
      return {
        id: row.id,
        title: work.title,
        domain,
        href: sourceId ? `${base}/${sourceId}` : null,
        addedAt: row.createdAt.toISOString(),
      };
    };

    return [
      ...media.map((r) =>
        toDto(
          r,
          r.mediaItem,
          "MEDIA",
          `/app/media/${r.mediaItem.type.toLowerCase()}`,
        ),
      ),
      ...games.map((r) => toDto(r, r.gameItem, "GAMES", "/app/games")),
      ...books.map((r) => toDto(r, r.bookItem, "BOOKS", "/app/books")),
      ...music.map((r) => toDto(r, r.musicItem, "MUSIC", "/app/music")),
    ]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .slice(0, RECENT_COUNT);
  }
}

/** The plan in force for the admin views, with the end of a premium grant. */
function planOf(
  entitlement: { plan: Plan; expiresAt: Date | null } | undefined,
): { plan: Plan; planExpiresAt: string | null } {
  if (!entitlement) return { plan: "FREE", planExpiresAt: null };
  const plan = effectivePlan(entitlement);
  return {
    plan,
    planExpiresAt:
      plan === "PREMIUM"
        ? (entitlement.expiresAt?.toISOString() ?? null)
        : null,
  };
}
