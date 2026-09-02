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
  ErrorCode,
  GameStatus,
  ReviewTargetType,
  XpReason,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  GameStatus as DbGameStatus,
  GameEntry,
  GameExternalId,
  GameItem,
  GameReplay,
  Prisma,
} from "@prisma/client";
import { AppException } from "../common/app.exception";
import { canonicalExternalId } from "../common/external-id.util";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { classifyStatusTransition } from "../social/activity-transition.util";
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

const PAGE_SIZE = 40;

type GameSortKey =
  "added" | "title" | "rating" | "playtime" | "finished" | "started" | "status";
const GAME_SORT_KEYS: GameSortKey[] = [
  "added",
  "title",
  "rating",
  "playtime",
  "finished",
  "started",
  "status",
];
const GAME_STATUS_SORT_ORDER = [
  "BACKLOG",
  "PLAYING",
  "COMPLETED",
  "DROPPED",
] as const;

export interface ListEntriesFilters {
  q?: string;
  favorite?: boolean;
  statuses?: string[];
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

function timeMs(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareGameEntries(
  sort: GameSortKey,
  a: GameEntryDto,
  b: GameEntryDto,
): number {
  switch (sort) {
    case "title":
      return a.game.title.localeCompare(b.game.title, "fr");
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
  ) {}

  /** Emits the status milestone + FAVORITED events for a game entry write. */
  private async emitEntryActivity(
    userId: string,
    gameItemId: string,
    change: {
      prevStatus: string | null;
      nextStatus: string;
      prevFavorite: boolean;
      nextFavorite: boolean;
    },
  ): Promise<void> {
    const transition = classifyStatusTransition(
      "GAMES",
      change.prevStatus,
      change.nextStatus,
    );

    if (transition) {
      await this.activity.emit({
        userId,
        type: transition.type,
        domain: "GAMES",
        targetType: ReviewTargetType.GAME,
        targetId: gameItemId,
        homeFeed: transition.homeFeed,
      });
    }

    if (change.nextFavorite && !change.prevFavorite) {
      await this.activity.emit({
        userId,
        type: ActivityType.FAVORITED,
        domain: "GAMES",
        targetType: ReviewTargetType.GAME,
        targetId: gameItemId,
        homeFeed: false,
      });
    }
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
      await this.xp.award(userId, XpReason.WORK_ADDED, entry.id);
      const domainEntryCount = await this.prisma.gameEntry.count({
        where: { userId },
      });

      if (domainEntryCount === 1) {
        await this.xp.award(userId, XpReason.DOMAIN_STARTED, Domain.GAMES);
      }
    }

    if (
      before?.status !== GameStatus.COMPLETED &&
      entry.status === GameStatus.COMPLETED
    ) {
      await this.xp.award(userId, XpReason.GAME_FINISHED, entry.id);
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.GAME,
        gameItem.id,
        dto.rating,
      );
    }

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
    let dtos = entries.map((e) =>
      toEntryDto(e, ratings.get(e.gameItemId) ?? null),
    );

    const q = filters.q?.trim().toLowerCase();
    dtos = dtos.filter((dto) => {
      if (filters.favorite && !dto.favorite) return false;
      if (q && !dto.game.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const sort = GAME_SORT_KEYS.includes(filters.sort as GameSortKey)
      ? (filters.sort as GameSortKey)
      : "added";
    const asc = filters.order === "asc";
    dtos.sort((a, b) => {
      const c = compareGameEntries(sort, a, b);
      return asc ? -c : c;
    });

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 ? filters.limit : PAGE_SIZE;
    const start = (page - 1) * limit;
    return {
      items: dtos.slice(start, start + limit),
      total: dtos.length,
      hasMore: dtos.length > page * limit,
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
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.GAME,
        entry.gameItemId,
        dto.rating,
      );
    }

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
    // them (same [G1] rule as library.service.ts's deleteEntry).
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
      this.prisma.review.deleteMany({
        where: { userId, targetId: entry.gameItemId },
      }),
      this.prisma.comment.updateMany({
        where: {
          authorId: userId,
          targetId: entry.gameItemId,
          deletedAt: null,
        },
        data: { text: null, deletedAt: new Date() },
      }),
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

  /** Log a completed replay (a completion beyond the entry's first one). */
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
    const replay = await this.prisma.gameReplay.findUnique({
      where: { id: replayId },
      include: { gameEntry: true },
    });

    if (!replay) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryReplayNotFound,
      );
    }

    if (replay.gameEntry.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibraryReplayForbidden,
      );
    }

    await this.prisma.gameReplay.delete({ where: { id: replayId } });
    await this.xp.revokeBySource("GameReplay", [replayId]);
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

  private async assertEntryOwnership(
    userId: string,
    entryId: string,
  ): Promise<GameEntry> {
    const entry = await this.prisma.gameEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEntryNotFound,
      );
    }

    if (entry.userId !== userId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibraryEntryForbidden,
      );
    }

    return entry;
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

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
