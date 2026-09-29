import type {
  BulkEntriesResultDto,
  BulkEntriesTargetDto,
  GameDetailDto,
  GameEntryDto,
  GameItemDto,
  GamePlaythroughDto,
  GameSource,
  PagedResult,
  PileSummaryDto,
} from "@loomkeep/shared";
import {
  Domain,
  DORMANT_AFTER_DAYS,
  GameStatus,
  ReviewTargetType,
  TrackingCycleStatus,
  XpReason,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type {
  GameStatus as DbGameStatus,
  GameExternalId,
  GameItem,
  GamePlaythrough,
  Prisma,
} from "@prisma/client";
import {
  addToList,
  applyBulkUpdate,
  applyToEntries,
  assertBulkTarget,
  assertBulkUpdate,
} from "../common/bulk-entries.util";
import { toDateOrNull } from "../common/date.util";
import type {
  EntryStatusChange,
  ListEntriesFilters,
} from "../common/entry-lifecycle.util";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  emitEntryActivity,
  listEntryPage,
  polymorphicTargetCleanup,
  RECENTLY_UPDATED_FIRST,
  searchTerm,
  titleContains,
} from "../common/entry-lifecycle.util";
import { canonicalExternalId } from "../common/external-id.util";
import { compareTitles, timeMs } from "../common/sort.util";
import { EventsGateway } from "../events/events.gateway";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/registry";
import { SessionXpService } from "../gamification/session-xp.service";
import { XpService } from "../gamification/xp.service";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { ActivityService } from "../social/activity.service";
import {
  GAME_PILE_STATUSES,
  gamePileItem,
  summarizePile,
} from "../stats/pile.util";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import type { BulkUpdateGameEntriesBody } from "./dto/bulk-update-game-entries.dto";
import { UpdateGameEntryDto } from "./dto/update-game-entry.dto";
import { UpsertGameEntryDto } from "./dto/upsert-game-entry.dto";
import { GameItemService } from "./game-item.service";

// Entries always need the game + its external IDs (canonical sourceId), plus
// its playthrough history, most recent first.
const ENTRY_INCLUDE = {
  gameItem: { include: { externalIds: true } },
  playthroughs: {
    orderBy: { number: "desc" },
    include: { _count: { select: { sessions: true } } },
  },
  sessions: {
    orderBy: { occurredAt: "desc" },
    take: 1,
    select: { occurredAt: true },
  },
} satisfies Prisma.GameEntryInclude;

type EntryWithGame = Prisma.GameEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

type GameSortKey =
  "added" | "title" | "rating" | "playtime" | "finished" | "started" | "status";
const GAME_SORT_KEYS = [
  "added",
  "title",
  "rating",
  "playtime",
  "finished",
  "started",
  "status",
] as const satisfies readonly GameSortKey[];
const GAME_STATUS_SORT_ORDER = [
  "BACKLOG",
  "PLAYING",
  "COMPLETED",
  "DROPPED",
] as const;

/** What ranking a game entry reads — a light slice of its DTO. */
type GameRow = Pick<
  GameEntryDto,
  | "id"
  | "status"
  | "rating"
  | "playtimeMinutes"
  | "startedAt"
  | "finishedAt"
  | "createdAt"
> & { game: Pick<GameItemDto, "title"> };

const GAME_ROW_SELECT = {
  id: true,
  gameItemId: true,
  status: true,
  playtimeMinutes: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  gameItem: { select: { title: true } },
} satisfies Prisma.GameEntrySelect;

// The sorts on a stored column, which Postgres pages itself. Unset dates go
// last in the natural (newest first) order, where `timeMs` ranks them.
const GAME_SQL_SORTS: Partial<
  Record<
    GameSortKey,
    (asc: boolean) => Prisma.GameEntryOrderByWithRelationInput[]
  >
> = {
  added: (asc) => [{ createdAt: asc ? "asc" : "desc" }],
  playtime: (asc) => [{ playtimeMinutes: asc ? "asc" : "desc" }],
  finished: (asc) => [
    {
      finishedAt: { sort: asc ? "asc" : "desc", nulls: asc ? "first" : "last" },
    },
  ],
  started: (asc) => [
    {
      startedAt: { sort: asc ? "asc" : "desc", nulls: asc ? "first" : "last" },
    },
  ],
};

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareGameEntries(
  sort: GameSortKey,
  a: GameRow,
  b: GameRow,
  locale: string | undefined,
): number {
  switch (sort) {
    case "title":
      return compareTitles(a.game.title, b.game.title, locale);
    case "rating":
      return (b.rating ?? -1) - (a.rating ?? -1);
    case "playtime":
      return b.playtimeMinutes - a.playtimeMinutes;
    case "finished":
      return timeMs(b.finishedAt) - timeMs(a.finishedAt);
    case "started":
      return timeMs(b.startedAt) - timeMs(a.startedAt);
    case "status":
      return (
        GAME_STATUS_SORT_ORDER.indexOf(a.status) -
        GAME_STATUS_SORT_ORDER.indexOf(b.status)
      );
    case "added":
      return b.createdAt.localeCompare(a.createdAt);
  }
}

@Injectable()
export class GameLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameItemService: GameItemService,
    private readonly ageGate: AgeGateService,
    private readonly reviews: ReviewService,
    private readonly activity: ActivityService,
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
    private readonly events: EventsGateway,
    private readonly lists: ListService,
    private readonly sessionXp?: SessionXpService,
  ) {}

  /** Emits the status milestone + FAVORITED events for a game entry write. */
  private emitEntryActivity(
    userId: string,
    gameItemId: string,
    change: EntryStatusChange,
  ): Promise<void> {
    return emitEntryActivity(
      this.activity,
      {
        userId,
        domain: Domain.GAMES,
        targetType: ReviewTargetType.GAME,
        targetId: gameItemId,
      },
      change,
    );
  }

  /** First touch of a game persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertGameEntryDto,
  ): Promise<GameEntryDto> {
    const gameItem = await this.gameItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
    );

    const before = await this.prisma.gameEntry.findUnique({
      where: { userId_gameItemId: { userId, gameItemId: gameItem.id } },
      select: { status: true, favorite: true, finishedAt: true },
    });

    const changes = {
      status: dto.status,
      notes: dto.notes,
      favorite: dto.favorite,
      ...(dto.status === GameStatus.COMPLETED && !before?.finishedAt
        ? { finishedAt: new Date() }
        : {}),
    };
    let entry = await this.prisma.gameEntry.upsert({
      where: { userId_gameItemId: { userId, gameItemId: gameItem.id } },
      update: changes,
      create: { userId, gameItemId: gameItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });
    const statusPlaythrough =
      dto.status &&
      before?.status !== dto.status &&
      (before !== null || dto.status !== GameStatus.BACKLOG)
        ? await this.syncPlaythroughStatus(entry.id, dto.status)
        : null;

    if (statusPlaythrough) {
      entry = await this.prisma.gameEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: ENTRY_INCLUDE,
      });
    }

    await this.emitEntryActivity(userId, gameItem.id, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (
      before?.status === GameStatus.COMPLETED &&
      entry.status !== GameStatus.COMPLETED &&
      statusPlaythrough
    ) {
      await this.xp.revokeBySource("GamePlaythrough", [statusPlaythrough.id]);
    }

    if (before === null) {
      await awardNewEntryXp(this.xp, {
        userId,
        entryId: entry.id,
        domain: Domain.GAMES,
        countEntries: () => this.prisma.gameEntry.count({ where: { userId } }),
      });
    }

    if (
      before?.status !== GameStatus.COMPLETED &&
      entry.status === GameStatus.COMPLETED &&
      statusPlaythrough
    ) {
      const reason =
        statusPlaythrough.number === 1
          ? XpReason.GAME_FINISHED
          : XpReason.GAME_REPLAYED;
      await this.xp.award(userId, reason, statusPlaythrough.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[reason],
      );
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.GAME,
        gameItem.id,
        dto.rating,
      );
    }

    // add_title/mark_complete are two of the onboarding checklist's steps
    // (see OnboardingService) — pushed unconditionally rather than checking
    // whether onboarding is even still in progress first, since that check
    // would cost as much as the emit is worth avoiding.
    this.events.emitToUser(userId, "onboarding-updated");

    return toEntryDto(
      entry,
      await this.reviews.getRating(userId, ReviewTargetType.GAME, gameItem.id),
    );
  }

  async listEntries(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PagedResult<GameEntryDto>> {
    const where = this.entryWhere(userId, filters);
    const ratingsOf = (gameItemIds: string[]) =>
      this.reviews.getRatings(userId, ReviewTargetType.GAME, gameItemIds);

    return listEntryPage(filters, {
      sortKeys: GAME_SORT_KEYS,
      defaultSort: "added",
      compare: compareGameEntries,
      sqlSorts: GAME_SQL_SORTS,
      sqlPage: async (orderBy, skip, take) => {
        const [page, total] = await Promise.all([
          this.prisma.gameEntry.findMany({
            where,
            orderBy: [...orderBy, ...RECENTLY_UPDATED_FIRST],
            skip,
            take,
            select: { id: true },
          }),
          this.prisma.gameEntry.count({ where }),
        ]);
        return { ids: page.map((e) => e.id), total };
      },
      rows: async (sort) => {
        const rows = await this.prisma.gameEntry.findMany({
          where,
          orderBy: RECENTLY_UPDATED_FIRST,
          select: GAME_ROW_SELECT,
        });
        const ratings =
          sort === "rating"
            ? await ratingsOf(rows.map((r) => r.gameItemId))
            : new Map<string, number>();
        return rows.map((r) => ({
          id: r.id,
          status: r.status,
          rating: ratings.get(r.gameItemId) ?? null,
          playtimeMinutes: r.playtimeMinutes,
          startedAt: r.startedAt?.toISOString() ?? null,
          finishedAt: r.finishedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          game: { title: r.gameItem.title },
        }));
      },
      load: async (ids) => {
        const entries = await this.prisma.gameEntry.findMany({
          where: { id: { in: ids } },
          include: ENTRY_INCLUDE,
        });
        const ratings = await ratingsOf(entries.map((e) => e.gameItemId));
        return entries.map((e) =>
          toEntryDto(e, ratings.get(e.gameItemId) ?? null),
        );
      },
    });
  }

  /**
   * What's left to play among the entries the list would show under the same
   * filters (UX-02), from IGDB's "normal" playthrough average. A game IGDB
   * has no average for is left out of the total, and `counted` says so.
   */
  async getPile(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PileSummaryDto> {
    const entries = await this.prisma.gameEntry.findMany({
      where: {
        AND: [
          this.entryWhere(userId, filters),
          { status: { in: [...GAME_PILE_STATUSES] } },
        ],
      },
      select: {
        status: true,
        playtimeMinutes: true,
        gameItem: { select: { timeToBeatNormallyMin: true } },
      },
    });
    return summarizePile(
      "MINUTES",
      entries.map((e) =>
        gamePileItem(
          e.status,
          e.gameItem.timeToBeatNormallyMin,
          e.playtimeMinutes,
        ),
      ),
    );
  }

  /**
   * Applies one change to every targeted entry, each through updateEntry
   * (or the list's addItem), so the side effects match a single update's.
   */
  async bulkUpdate(
    userId: string,
    dto: BulkUpdateGameEntriesBody,
  ): Promise<BulkEntriesResultDto> {
    assertBulkUpdate(dto);
    const entries = await this.prisma.gameEntry.findMany({
      where: this.bulkWhere(userId, dto),
      orderBy: RECENTLY_UPDATED_FIRST,
      select: {
        id: true,
        gameItemId: true,
        status: true,
        favorite: true,
        ownershipStatus: true,
        ownershipSource: true,
      },
    });
    return applyBulkUpdate(
      entries.map((e) => ({ ...e, itemId: e.gameItemId })),
      dto,
      {
        update: (id, patch) =>
          this.updateEntry(userId, id, patch as UpdateGameEntryDto),
        addToList: (itemId) =>
          addToList(this.lists, userId, dto.listId!, "GAME", itemId),
      },
    );
  }

  /** Removes every targeted entry, each through deleteEntry. */
  async bulkDelete(
    userId: string,
    target: BulkEntriesTargetDto,
  ): Promise<BulkEntriesResultDto> {
    assertBulkTarget(target);
    const entries = await this.prisma.gameEntry.findMany({
      where: this.bulkWhere(userId, target),
      select: { id: true },
    });
    return applyToEntries(entries, async (e) => {
      await this.deleteEntry(userId, e.id);
      return true;
    });
  }

  private bulkWhere(
    userId: string,
    target: BulkEntriesTargetDto,
  ): Prisma.GameEntryWhereInput {
    return target.filters
      ? this.entryWhere(userId, target.filters)
      : { userId, id: { in: target.ids ?? [] } };
  }

  private entryWhere(
    userId: string,
    filters: ListEntriesFilters,
  ): Prisma.GameEntryWhereInput {
    const q = searchTerm(filters);
    const statuses = filters.statuses ?? [];
    const persistedStatuses = statuses.filter(
      (status) => status !== "PAUSED",
    ) as DbGameStatus[];
    const statusFilters: Prisma.GameEntryWhereInput[] = [];

    if (persistedStatuses.length > 0) {
      statusFilters.push({ status: { in: persistedStatuses } });
    }

    if (statuses.includes("PAUSED")) {
      const cutoff = new Date(
        Date.now() - DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000,
      );
      statusFilters.push({
        status: GameStatus.PLAYING,
        sessions: {
          some: { occurredAt: { lt: cutoff } },
          none: { occurredAt: { gte: cutoff } },
        },
      });
    }

    return {
      userId,
      AND: statusFilters.length > 0 ? [{ OR: statusFilters }] : undefined,
      favorite: filters.favorite ? true : undefined,
      gameItem: q ? { title: titleContains(q) } : undefined,
    };
  }

  async getEntry(userId: string, entryId: string): Promise<GameEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.gameEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.GAME,
        entry.gameItemId,
      ),
    );
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateGameEntryDto,
  ): Promise<GameEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const before = await this.prisma.gameEntry.findUnique({
      where: { id: entryId },
      select: { status: true, favorite: true, finishedAt: true },
    });

    const completedPlaythrough =
      dto.status && before?.status !== dto.status
        ? await this.syncPlaythroughStatus(entryId, dto.status)
        : null;

    const entry = await this.prisma.gameEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        notes: dto.notes,
        favorite: dto.favorite,
        playtimeMinutes: dto.playtimeMinutes,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? dto.status === GameStatus.COMPLETED && before?.finishedAt === null
              ? new Date()
              : undefined
            : toDateOrNull(dto.finishedAt),
        ownershipStatus: dto.ownershipStatus,
        ownershipSource: dto.ownershipSource,
      },
      include: ENTRY_INCLUDE,
    });

    await this.emitEntryActivity(userId, entry.gameItemId, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (
      before?.status === GameStatus.COMPLETED &&
      entry.status !== GameStatus.COMPLETED &&
      completedPlaythrough
    ) {
      await this.xp.revokeBySource("GamePlaythrough", [
        completedPlaythrough.id,
      ]);
    }

    if (
      before?.status !== GameStatus.COMPLETED &&
      entry.status === GameStatus.COMPLETED &&
      completedPlaythrough
    ) {
      const reason =
        completedPlaythrough.number === 1
          ? XpReason.GAME_FINISHED
          : XpReason.GAME_REPLAYED;
      await this.xp.award(userId, reason, completedPlaythrough.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[reason],
      );
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.GAME,
        entry.gameItemId,
        dto.rating,
      );
    }

    this.events.emitToUser(userId, "onboarding-updated");

    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.GAME,
        entry.gameItemId,
      ),
    );
  }

  /** Reviews and comments are polymorphic and need explicit cleanup. */
  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    // Loaded before the transaction because cycles cascade with the entry.
    const playthroughs = await this.prisma.gamePlaythrough.findMany({
      where: { gameEntryId: entryId },
      select: { id: true },
    });
    const sessions = await this.prisma.gameSession.findMany({
      where: { gameEntryId: entryId },
      select: { id: true, createdAt: true },
    });
    // Same reason: the transaction below deletes this Review outright (not
    // via ReviewService, which handles its own XP revocation) —
    // WORK_RATED/REVIEW_WRITTEN/REVIEW_DETAILED would otherwise linger
    // until the next nightly reconciliation.
    const reviews = await this.prisma.review.findMany({
      where: { userId, targetId: entry.gameItemId },
      select: { id: true },
    });

    await this.prisma.$transaction([
      ...polymorphicTargetCleanup(this.prisma, userId, [entry.gameItemId]),
      this.prisma.gameEntry.delete({ where: { id: entryId } }),
    ]);

    await this.xp.revokeBySource("GameEntry", [entryId]); // GAME_FINISHED
    await this.xp.revokeBySource("Entry", [entryId]); // WORK_ADDED
    await this.xp.revokeBySource(
      "GamePlaythrough",
      playthroughs.map((playthrough) => playthrough.id),
    );
    await this.xp.revokeBySource(
      "Review",
      reviews.map((r) => r.id),
    ); // WORK_RATED / REVIEW_WRITTEN / REVIEW_DETAILED
    await Promise.all(
      sessions.map((session) =>
        this.activity.deleteLinked("GameSession", session.id),
      ),
    );

    if (this.sessionXp) {
      for (const session of sessions) {
        await this.sessionXp.refreshAfterDelete(userId, session.createdAt);
      }
    }
  }

  /**
   * Game detail page: catalogue metadata + the user's library state in one
   * call. Served from the cache when the game is already persisted, otherwise
   * fetched live (persisting nothing — a previewed game must not enter the
   * on-demand cache).
   */
  async getGameDetail(
    userId: string,
    source: GameSource,
    sourceId: string,
  ): Promise<GameDetailDto> {
    const details = await this.gameItemService.getLiveDetails(source, sourceId);
    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    this.ageGate.assertAdultAllowed(details.isAdult, allowAdult);

    details.similarGames = filterAdultContent(details.similarGames, allowAdult);
    details.franchiseGames = filterAdultContent(
      details.franchiseGames,
      allowAdult,
    );

    const ref = await this.prisma.gameExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
    });
    const entryRow = ref
      ? await this.prisma.gameEntry.findUnique({
          where: {
            userId_gameItemId: { userId, gameItemId: ref.gameItemId },
          },
          include: ENTRY_INCLUDE,
        })
      : null;

    return {
      ...details,
      commentTargetId: ref?.gameItemId ?? null,
      entry: entryRow
        ? toEntryDto(
            entryRow,
            await this.reviews.getRating(
              userId,
              ReviewTargetType.GAME,
              entryRow.gameItemId,
            ),
          )
        : null,
    };
  }

  private assertEntryOwnership(userId: string, entryId: string) {
    return assertEntryOwnership(userId, () =>
      this.prisma.gameEntry.findUnique({ where: { id: entryId } }),
    );
  }

  private async syncPlaythroughStatus(entryId: string, status: DbGameStatus) {
    const active = await this.prisma.gamePlaythrough.findFirst({
      where: { gameEntryId: entryId, status: TrackingCycleStatus.ACTIVE },
      include: { _count: { select: { sessions: true } } },
    });
    const latest =
      active ??
      (await this.prisma.gamePlaythrough.findFirst({
        where: { gameEntryId: entryId },
        orderBy: { number: "desc" },
        include: { _count: { select: { sessions: true } } },
      }));

    if (status === GameStatus.BACKLOG) {
      if (active && active._count.sessions === 0) {
        await this.prisma.gamePlaythrough.delete({ where: { id: active.id } });
      }

      return null;
    }

    if (status === GameStatus.PLAYING) {
      if (active) return active;

      if (latest) {
        return this.prisma.gamePlaythrough.update({
          where: { id: latest.id },
          data: { status: TrackingCycleStatus.ACTIVE, finishedAt: null },
        });
      }

      return this.prisma.gamePlaythrough.create({
        data: {
          gameEntryId: entryId,
          number: 1,
          status: TrackingCycleStatus.ACTIVE,
          startedAt: new Date(),
        },
      });
    }

    const target =
      active ??
      latest ??
      (await this.prisma.gamePlaythrough.create({
        data: {
          gameEntryId: entryId,
          number: 1,
          status: TrackingCycleStatus.ACTIVE,
          startedAt: new Date(),
        },
      }));
    return this.prisma.gamePlaythrough.update({
      where: { id: target.id },
      data: {
        status:
          status === GameStatus.COMPLETED
            ? TrackingCycleStatus.COMPLETED
            : TrackingCycleStatus.DROPPED,
        finishedAt: new Date(),
      },
    });
  }
}

function toGameItemDto(
  game: GameItem & { externalIds: GameExternalId[] },
): GameItemDto {
  return {
    id: game.id,
    title: game.title,
    coverUrl: game.coverUrl,
    canonicalSource: game.canonicalSource,
    sourceId: canonicalExternalId(game, game.externalIds),
  };
}

function toEntryDto(entry: EntryWithGame, rating: number | null): GameEntryDto {
  return {
    id: entry.id,
    game: toGameItemDto(entry.gameItem),
    status: entry.status,
    rating,
    notes: entry.notes,
    favorite: entry.favorite,
    playtimeMinutes: entry.playtimeMinutes,
    trackedPlaytimeMinutes: entry.trackedPlaytimeMinutes,
    steamPlaytimeMinutes: entry.steamPlaytimeMinutes,
    steamSyncedAt: entry.steamSyncedAt?.toISOString() ?? null,
    lastSessionAt: entry.sessions[0]?.occurredAt.toISOString() ?? null,
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    playthroughs: entry.playthroughs.map(toPlaythroughDto),
    ownershipStatus: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
  };
}

function toPlaythroughDto(
  playthrough: GamePlaythrough & { _count: { sessions: number } },
): GamePlaythroughDto {
  return {
    id: playthrough.id,
    number: playthrough.number,
    status: playthrough.status,
    startedAt: playthrough.startedAt?.toISOString() ?? null,
    finishedAt: playthrough.finishedAt?.toISOString() ?? null,
    sessionCount: playthrough._count.sessions,
    trackedMinutes: playthrough.trackedMinutes,
    legacyIncomplete: playthrough.legacyIncomplete,
  };
}
