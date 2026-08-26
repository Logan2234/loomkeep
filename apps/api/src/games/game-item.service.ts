import type { GameDetailsDto, GameSource } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type { GameItem } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  GameCatalogProvider,
  ProviderGameDetails,
} from "./providers/game-provider.types";
import { IgdbProvider } from "./providers/igdb.provider";

// A cached game referenced by users is refreshed at most once a day.
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class GameItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly igdbProvider: IgdbProvider,
  ) {}

  providerFor(): GameCatalogProvider {
    // IGDB is the only game source today; this indirection keeps the
    // multi-source seam for when another one lands.
    return this.igdbProvider;
  }

  /** Live details straight from the provider — nothing is persisted. */
  async getLiveDetails(
    source: GameSource,
    sourceId: string,
  ): Promise<GameDetailsDto> {
    const details = await this.providerFor().getDetails(sourceId);
    return {
      ...details.summary,
      overview: details.overview,
      backdropUrl: details.backdropUrl,
      screenshots: details.screenshots,
      genres: details.genres,
      platforms: details.platforms,
      releaseDate: details.releaseDate,
      website: details.website,
      similarGames: details.similarGames,
      developers: details.developers,
      publishers: details.publishers,
      gameModes: details.gameModes,
      playerPerspectives: details.playerPerspectives,
      franchiseGames: details.franchiseGames,
      ratings: details.ratings,
    };
  }

  /**
   * On-demand cache entry point: called when a user starts referencing a game.
   * Fetches from the canonical source and persists the game with its external
   * IDs. Throttled by lastSyncedAt (24h TTL).
   */
  async upsertFromSource(
    source: GameSource,
    sourceId: string,
  ): Promise<GameItem> {
    const existingRef = await this.prisma.gameExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
      include: { gameItem: true },
    });

    if (
      existingRef &&
      Date.now() - existingRef.gameItem.lastSyncedAt.getTime() < SYNC_TTL_MS
    ) {
      return existingRef.gameItem;
    }

    const details = await this.providerFor().getDetails(sourceId);
    return this.persistDetails(source, details);
  }

  /**
   * Persist a game from details already fetched from the provider (create or
   * refresh). Lets a bulk importer resolve many games in a couple of provider
   * calls, then persist them here without one round-trip per game.
   */
  async persistDetails(
    source: GameSource,
    details: ProviderGameDetails,
  ): Promise<GameItem> {
    const canonicalId = details.externalIds.find(
      (ext) => ext.source === source,
    )?.externalId;

    if (!canonicalId) {
      throw new Error(`Provider details for ${source} carry no ${source} id`);
    }

    const existingRef = await this.prisma.gameExternalId.findUnique({
      where: { source_externalId: { source, externalId: canonicalId } },
    });
    return existingRef
      ? this.refresh(existingRef.gameItemId, details)
      : this.createFresh(source, details);
  }

  /** Admin-triggered re-sync: refetches from the canonical source, bypassing the TTL. */
  async forceRefresh(gameItemId: string): Promise<GameItem> {
    const item = await this.prisma.gameItem.findUniqueOrThrow({
      where: { id: gameItemId },
      include: { externalIds: true },
    });
    const sourceId = item.externalIds.find(
      (ext) => ext.source === item.canonicalSource,
    )?.externalId;

    if (!sourceId) {
      throw new Error(`Game ${gameItemId} has no ${item.canonicalSource} id`);
    }

    const details = await this.providerFor().getDetails(sourceId);
    return this.persistDetails(item.canonicalSource as GameSource, details);
  }

  private async createFresh(
    source: GameSource,
    details: ProviderGameDetails,
  ): Promise<GameItem> {
    return this.prisma.gameItem.create({
      data: {
        ...this.baseFields(details),
        canonicalSource: source,
        externalIds: {
          create: details.externalIds.map((ext) => ({
            source: ext.source,
            externalId: ext.externalId,
          })),
        },
      },
    });
  }

  private async refresh(
    gameItemId: string,
    details: ProviderGameDetails,
  ): Promise<GameItem> {
    const item = await this.prisma.gameItem.update({
      where: { id: gameItemId },
      data: this.baseFields(details),
    });

    for (const ext of details.externalIds) {
      await this.prisma.gameExternalId.upsert({
        where: {
          source_externalId: { source: ext.source, externalId: ext.externalId },
        },
        update: { gameItemId },
        create: { gameItemId, source: ext.source, externalId: ext.externalId },
      });
    }

    return item;
  }

  private baseFields(details: ProviderGameDetails) {
    return {
      title: details.summary.title,
      coverUrl: details.summary.coverUrl,
      backdropUrl: details.backdropUrl,
      overview: details.overview,
      releaseDate: details.releaseDate ? new Date(details.releaseDate) : null,
      genres: details.genres,
      platforms: details.platforms,
      isAdult: details.summary.isAdult,
      lastSyncedAt: new Date(),
    };
  }
}
