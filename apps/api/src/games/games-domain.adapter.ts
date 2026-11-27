import {
  type GameOwnershipStatus,
  ReviewTargetType,
} from "@loomkeep/shared/enums";
import { Injectable } from "@nestjs/common";
import { toCsv } from "../common/csv.util";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
  toExternalIdDtos,
} from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import type { DomainAdapter, LibraryRow } from "../work/domain-adapter";
import { csvDate, itemHref, laterCompletions } from "../work/entry-export.util";
import { LOAN_INCLUDE, loanFields } from "../work/entry-loan.util";
import { bucketizeGameStatus } from "../work/status-bucket.util";
import type { DataExportGameEntry } from "./game-export.types";

/** The game library, as the modules that read every domain see it. */
@Injectable()
export class GamesDomainAdapter implements DomainAdapter<"GAMES"> {
  readonly domain = "GAMES";
  readonly reviewTargetType = ReviewTargetType.GAME;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
  ) {}

  countEntries(userId: string): Promise<number> {
    return this.prisma.gameEntry.count({ where: { userId } });
  }

  async libraryRows(userId: string): Promise<LibraryRow[]> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        gameItem: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            releaseDate: true,
            ...CANONICAL_EXTERNAL_ID_SELECT,
          },
        },
      },
    });

    return entries.map((e) => ({
      bucket: bucketizeGameStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.gameItem.releaseDate,
      itemId: e.gameItem.id,
      title: e.gameItem.title,
      imageUrl: e.gameItem.coverUrl,
      href: itemHref("games", e.gameItem),
    }));
  }

  async itemTitles(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const items = await this.prisma.gameItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    return new Map(items.map((i) => [i.id, i.title]));
  }

  async exportEntries(
    userId: string,
  ): Promise<{ games: DataExportGameEntry[] }> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId },
      include: {
        gameItem: { include: { externalIds: true } },
        ...LOAN_INCLUDE,
        playthroughs: { orderBy: { number: "asc" } },
        sessions: {
          orderBy: { occurredAt: "asc" },
          include: { playthrough: { select: { number: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.GAME,
      entries.map((e) => e.gameItemId),
    );

    return {
      games: entries.map((entry) => ({
        game: {
          title: entry.gameItem.title,
          canonicalSource: entry.gameItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.gameItem,
            entry.gameItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.gameItem.externalIds),
        },
        status: entry.status,
        rating: ratings.get(entry.gameItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        playtimeMinutes: entry.playtimeMinutes,
        trackedPlaytimeMinutes: entry.trackedPlaytimeMinutes,
        steamPlaytimeMinutes: entry.steamPlaytimeMinutes,
        steamSyncedAt: entry.steamSyncedAt?.toISOString() ?? null,
        ownershipStatus: entry.ownershipStatus as GameOwnershipStatus,
        ownershipSource: entry.ownershipSource,
        ...loanFields(entry),
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: laterCompletions(entry.playthroughs),
        playthroughs: entry.playthroughs.map((playthrough) => ({
          number: playthrough.number,
          status: playthrough.status,
          startedAt: playthrough.startedAt?.toISOString() ?? null,
          finishedAt: playthrough.finishedAt?.toISOString() ?? null,
          trackedMinutes: playthrough.trackedMinutes,
        })),
        sessions: entry.sessions.map((session) => ({
          durationMinutes: session.durationMinutes,
          notes: session.notes,
          occurredAt: session.occurredAt.toISOString(),
          source: session.source,
          createdAt: session.createdAt.toISOString(),
          playthroughNumber: session.playthrough?.number ?? null,
        })),
      })),
    };
  }

  async exportCsv(userId: string): Promise<string> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId },
      include: {
        gameItem: true,
        playthroughs: { where: { status: "COMPLETED" } },
      },
      orderBy: { createdAt: "asc" },
    });
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.GAME,
      entries.map((e) => e.gameItemId),
    );

    return toCsv([
      [
        "Title",
        "Status",
        "Rating",
        "Notes",
        "Favorite",
        "Playtime Minutes",
        "Started At",
        "Finished At",
        "Ownership Status",
        "Ownership Source",
        "Release Date",
        "Genres",
        "Platforms",
        "Replays",
      ],
      ...entries.map((e) => [
        e.gameItem.title,
        e.status,
        ratings.get(e.gameItemId) ?? null,
        e.notes,
        e.favorite ? "true" : "false",
        e.playtimeMinutes,
        csvDate(e.startedAt),
        csvDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        csvDate(e.gameItem.releaseDate),
        e.gameItem.genres.join("; "),
        e.gameItem.platforms.join("; "),
        Math.max(0, e.playthroughs.length - 1),
      ]),
    ]);
  }
}
