import type {
  GameDetailDto,
  GameEntryDto,
  GameItemDto,
  GameReplayDto,
  GameSource,
  PagedResult,
} from "@loomkeep/shared";
import {
  ActivityType,
  Domain,
  GameStatus,
  ReviewTargetType,
  XpReason,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type {
  GameStatus as DbGameStatus,
  GameExternalId,
  GameItem,
  GameReplay,
  Prisma,
} from "@prisma/client";
import { toDateOrNull } from "../common/date.util";
import type {
  EntryStatusChange,
  ListEntriesFilters,
} from "../common/entry-lifecycle.util";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  deleteOwnedReplay,
  emitEntryActivity,
  paginateEntries,
  polymorphicTargetCleanup,
} from "../common/entry-lifecycle.util";
import { canonicalExternalId } from "../common/external-id.util";
import { compareTitles, timeMs } from "../common/sort.util";
import { EventsGateway } from "../events/events.gateway";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/registry";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { ActivityService } from "../social/activity.service";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { AddGameReplayDto } from "./dto/add-game-replay.dto";
import { UpdateGameEntryDto } from "./dto/update-game-entry.dto";
import { UpsertGameEntryDto } from "./dto/upsert-game-entry.dto";
import { GameItemService } from "./game-item.service";

// Entries always need the game + its external IDs (canonical sourceId), plus
// its replay history, most recent first.
const ENTRY_INCLUDE = {
  gameItem: { include: { externalIds: true } },
  replays: { orderBy: { finishedAt: "desc" } },
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

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareGameEntries(
  sort: GameSortKey,
  a: GameEntryDto,
  b: GameEntryDto,
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
      select: { status: true, favorite: true },
    });

    const changes = {
      status: dto.status,
      notes: dto.notes,
      favorite: dto.favorite,
    };
    const entry = await this.prisma.gameEntry.upsert({
      where: { userId_gameItemId: { userId, gameItemId: gameItem.id } },
      update: changes,
      create: { userId, gameItemId: gameItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    await this.emitEntryActivity(userId, gameItem.id, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

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
      entry.status === GameStatus.COMPLETED
    ) {
      await this.xp.award(userId, XpReason.GAME_FINISHED, entry.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.GAME_FINISHED],
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
    const entries = await this.prisma.gameEntry.findMany({
      where: {
        userId,
        status:
          filters.statuses && filters.statuses.length > 0
            ? { in: filters.statuses as DbGameStatus[] }
            : undefined,
      },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.GAME,
      entries.map((e) => e.gameItemId),
    );
    const dtos = entries.map((e) =>
      toEntryDto(e, ratings.get(e.gameItemId) ?? null),
    );

    return paginateEntries(dtos, filters, {
      sortKeys: GAME_SORT_KEYS,
      defaultSort: "added",
      compare: compareGameEntries,
      title: (dto) => dto.game.title,
    });
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
      select: { status: true, favorite: true },
    });

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
            ? undefined
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
      before?.status !== GameStatus.COMPLETED &&
      entry.status === GameStatus.COMPLETED
    ) {
      await this.xp.award(userId, XpReason.GAME_FINISHED, entry.id);
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.GAME_FINISHED],
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

  /**
   * `GameReplay` cascades at the DB level (`onDelete: Cascade` on the entry
   * FK), but `Review`/`Comment` are polymorphic (targetType/targetId, no FK)
   * so they never did — same bug class as MEDIA's `deleteEntry` had before
   * commit `0db5dc6` fixed it there.
   */
  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    // Loaded before the transaction — GameReplay cascades at the DB level,
    // so its ids would otherwise be gone by the time revokeBySource needs
    // them when revocation runs after the transaction.
    const replays = await this.prisma.gameReplay.findMany({
      where: { gameEntryId: entryId },
      select: { id: true },
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
      "GameReplay",
      replays.map((r) => r.id),
    );
    await this.xp.revokeBySource(
      "Review",
      reviews.map((r) => r.id),
    ); // WORK_RATED / REVIEW_WRITTEN / REVIEW_DETAILED
  }

  async addReplay(
    userId: string,
    entryId: string,
    dto: AddGameReplayDto,
  ): Promise<GameEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const replay = await this.prisma.gameReplay.create({
      data: {
        gameEntryId: entryId,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : undefined,
      },
    });
    await this.xp.award(userId, XpReason.GAME_REPLAYED, replay.id);

    const entry = await this.prisma.gameEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });

    await this.activity.emit({
      userId,
      type: ActivityType.REWATCHED,
      domain: "GAMES",
      targetType: ReviewTargetType.GAME,
      targetId: entry.gameItemId,
      homeFeed: true,
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

  async deleteReplay(userId: string, replayId: string): Promise<void> {
    await deleteOwnedReplay(this.xp, {
      userId,
      replayId,
      xpSource: "GameReplay",
      findOwnerId: async () =>
        (
          await this.prisma.gameReplay.findUnique({
            where: { id: replayId },
            select: { gameEntry: { select: { userId: true } } },
          })
        )?.gameEntry.userId ?? null,
      remove: () => this.prisma.gameReplay.delete({ where: { id: replayId } }),
    });
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
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    replays: entry.replays.map(toReplayDto),
    ownershipStatus: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
  };
}

function toReplayDto(replay: GameReplay): GameReplayDto {
  return { id: replay.id, finishedAt: replay.finishedAt.toISOString() };
}
