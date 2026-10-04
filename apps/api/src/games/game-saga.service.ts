import type {
  GameSagaDto,
  GameSagaMemberDto,
  GameStatus,
  LibraryGameSagasDto,
  LibrarySagaSort,
} from "@loomkeep/shared";
import { isGameUpcoming } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import type { GameSagaMember } from "@prisma/client";
import {
  sagaComparator,
  sagaProgress,
  type SagaStatusReader,
} from "../library/saga-progress.util";
import { PrismaService } from "../prisma/prisma.service";
import { AgeGateService } from "../users/age-gate.service";
import type { ProviderGameSaga } from "./providers/game-provider.types";
import { IgdbProvider } from "./providers/igdb.provider";

// Same freshness as a cached GameItem.
const SAGA_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_GAMES = 5000;

const GAME_SAGA_STATUS: SagaStatusReader<GameSagaMemberDto> = {
  isSeen: (m) => m.status === "COMPLETED",
  isDropped: (m) => m.status === "DROPPED",
  isUpcoming: (m) => m.upcoming,
};

export interface LibraryGameSagaFilters {
  q?: string;
  sort?: LibrarySagaSort;
  order?: "asc" | "desc";
}

/**
 * Game series (IGDB collections) as the player sees them: the one on a game's
 * page, and the ones started across their library. A series with a tracked
 * game is saved, so the refresh job can tell a newly announced game from the
 * rest — the sequel alert's cue, as for films and anime. Reading one takes a
 * few throttled requests, so it's also kept a day in memory for every one of
 * its games.
 */
@Injectable()
export class GameSagaService {
  private readonly logger = new Logger(GameSagaService.name);
  private readonly cache = new Map<
    string,
    { fetchedAt: number; saga: ProviderGameSaga | null }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly igdb: IgdbProvider,
    private readonly ageGate: AgeGateService,
  ) {}

  async getSaga(userId: string, sourceId: string): Promise<GameSagaDto | null> {
    const saga = await this.read(sourceId);
    if (!saga) return null;

    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    const members = saga.members.filter(
      (m) => allowAdult || !m.isAdult || m.sourceId === sourceId,
    );
    if (members.length < 2) return null;

    const ids = members.map((m) => m.sourceId);
    const [statuses, tagged] = await Promise.all([
      this.statusesBySourceId(userId, ids),
      this.rememberMembership(ids, saga.key),
    ]);

    // A game just tracked joins its series now rather than at the next
    // refresh, so the library's sagas view shows it straight away.
    if (tagged > 0) {
      this.sync(sourceId).catch((err) =>
        this.logger.warn(`Game saga sync failed: ${saga.key}`, err),
      );
    }

    return {
      key: saga.key,
      title: saga.title,
      members: members.map((m) => ({
        ...m,
        status: statuses.get(m.sourceId) ?? null,
      })),
    };
  }

  /** The series of the player's library, from what the refresh job saved. */
  async listSagas(
    userId: string,
    filters: LibraryGameSagaFilters = {},
  ): Promise<LibraryGameSagasDto> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId, gameItem: { sagaKey: { not: null } } },
      select: {
        updatedAt: true,
        finishedAt: true,
        gameItem: { select: { sagaKey: true } },
      },
    });
    const lastActivity = new Map<string, Date>();
    const lastFinished = new Map<string, Date>();

    for (const { updatedAt, finishedAt, gameItem } of entries) {
      const key = gameItem.sagaKey!;
      const last = lastActivity.get(key);
      if (!last || updatedAt > last) lastActivity.set(key, updatedAt);
      const finished = lastFinished.get(key);

      if (finishedAt && (!finished || finishedAt > finished)) {
        lastFinished.set(key, finishedAt);
      }
    }

    const sagas = await this.prisma.gameSaga.findMany({
      where: { key: { in: [...lastActivity.keys()] } },
      include: { members: { orderBy: { position: "asc" } } },
    });
    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    const statuses = await this.statusesBySourceId(
      userId,
      sagas.flatMap((saga) => saga.members.map((m) => m.sourceId)),
    );
    const q = filters.q?.trim().toLowerCase();
    const result: LibraryGameSagasDto = {
      inProgress: [],
      waiting: [],
      finished: [],
    };

    for (const saga of sagas) {
      const members = saga.members
        .filter((m) => allowAdult || !m.isAdult)
        .map((m) => toMemberDto(m, statuses.get(m.sourceId)));

      if (
        q &&
        !saga.title.toLowerCase().includes(q) &&
        !members.some((m) => m.title.toLowerCase().includes(q))
      ) {
        continue;
      }

      const progress = sagaProgress(members, GAME_SAGA_STATUS);
      if (progress.state === "none") continue;
      result[progress.state].push({
        key: saga.key,
        title: saga.title,
        members,
        next: progress.next,
        seen: progress.seen,
        released: progress.released,
        lastActivityAt: lastActivity.get(saga.key)!.toISOString(),
        finishedAt: lastFinished.get(saga.key)?.toISOString() ?? null,
      });
    }

    const compare = sagaComparator(filters.sort ?? "recent");
    const direction = filters.order === "asc" ? -1 : 1;

    for (const list of [result.inProgress, result.waiting, result.finished]) {
      list.sort((a, b) => compare(a, b) * direction);
    }

    return result;
  }

  /** The series as IGDB shows it now. */
  async read(sourceId: string): Promise<ProviderGameSaga | null> {
    const cached = this.cache.get(sourceId);

    if (cached && Date.now() - cached.fetchedAt < SAGA_TTL_MS) {
      return cached.saga;
    }

    const saga = await this.igdb.getSaga(sourceId);
    const entry = { fetchedAt: Date.now(), saga };

    for (const id of saga ? saga.members.map((m) => m.sourceId) : [sourceId]) {
      this.cache.delete(id);
      this.cache.set(id, entry);
    }

    // Maps iterate in insertion order: the first keys are the oldest.
    for (const key of this.cache.keys()) {
      if (this.cache.size <= MAX_CACHED_GAMES) break;
      this.cache.delete(key);
    }

    return saga;
  }

  /**
   * Reads a tracked game's series and saves it. A game that joins a series
   * already saved is stamped `announcedAt`: the sequel alert's cue.
   */
  async sync(sourceId: string): Promise<void> {
    const saga = await this.read(sourceId);
    if (saga) await this.save(saga);
  }

  /** Tags the tracked games of the series with its key. */
  private async rememberMembership(
    sourceIds: string[],
    sagaKey: string,
  ): Promise<number> {
    const { count } = await this.prisma.gameItem.updateMany({
      where: {
        externalIds: {
          some: { source: "IGDB", externalId: { in: sourceIds } },
        },
        OR: [{ sagaKey: null }, { sagaKey: { not: sagaKey } }],
      },
      data: { sagaKey },
    });
    return count;
  }

  private async save(saga: ProviderGameSaga): Promise<void> {
    const ids = saga.members.map((m) => m.sourceId);
    const tracked = await this.prisma.gameItem.count({
      where: {
        externalIds: { some: { source: "IGDB", externalId: { in: ids } } },
      },
    });
    if (tracked === 0) return;

    const known = await this.prisma.gameSagaMember.findMany({
      where: { sagaKey: saga.key },
      select: { sourceId: true },
    });
    const knownIds = new Set(known.map((m) => m.sourceId));
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.gameSaga.upsert({
        where: { key: saga.key },
        create: { key: saga.key, title: saga.title, syncedAt: now },
        update: { title: saga.title, syncedAt: now },
      }),
      ...saga.members.map((member, position) => {
        const fields = {
          position,
          title: member.title,
          coverUrl: member.coverUrl,
          releaseDate: member.releaseDate,
          releaseDatePrecision: member.releaseDatePrecision,
          isAdult: member.isAdult,
          upcoming: member.upcoming,
        };
        return this.prisma.gameSagaMember.upsert({
          where: {
            sagaKey_sourceId: { sagaKey: saga.key, sourceId: member.sourceId },
          },
          update: fields,
          create: {
            ...fields,
            sagaKey: saga.key,
            sourceId: member.sourceId,
            announcedAt:
              knownIds.size > 0 && !knownIds.has(member.sourceId) ? now : null,
          },
        });
      }),
      this.prisma.gameSagaMember.deleteMany({
        where: { sagaKey: saga.key, sourceId: { notIn: ids } },
      }),
    ]);

    await this.rememberMembership(ids, saga.key);
  }

  private async statusesBySourceId(
    userId: string,
    sourceIds: string[],
  ): Promise<Map<string, GameStatus>> {
    if (sourceIds.length === 0) return new Map();
    const entries = await this.prisma.gameEntry.findMany({
      where: {
        userId,
        gameItem: {
          externalIds: {
            some: { source: "IGDB", externalId: { in: sourceIds } },
          },
        },
      },
      select: {
        status: true,
        gameItem: {
          select: {
            externalIds: {
              where: { source: "IGDB" },
              select: { externalId: true },
            },
          },
        },
      },
    });
    return new Map(
      entries.flatMap((e) =>
        e.gameItem.externalIds.map(
          (ext) => [ext.externalId, e.status] as const,
        ),
      ),
    );
  }
}

function toMemberDto(
  m: GameSagaMember,
  status: GameStatus | undefined,
): GameSagaMemberDto {
  return {
    source: "IGDB",
    sourceId: m.sourceId,
    title: m.title,
    year: m.releaseDate ? Number(m.releaseDate.slice(0, 4)) : null,
    coverUrl: m.coverUrl,
    isAdult: m.isAdult,
    releaseDate: m.releaseDate,
    releaseDatePrecision: m.releaseDatePrecision,
    // Read now rather than as saved: a date passes between two refreshes.
    upcoming: isGameUpcoming(m.releaseDate, m.releaseDatePrecision),
    status: status ?? null,
  };
}
