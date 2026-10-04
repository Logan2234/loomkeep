import type { GameDetailsDto, GameSource } from "@loomkeep/shared";
import { isGameUpcoming } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { GameItem } from "@prisma/client";
import { mapWithConcurrency } from "../common/concurrency.util";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { PrismaService } from "../prisma/prisma.service";
import { GameSagaService } from "./game-saga.service";
import type {
  GameCatalogProvider,
  ProviderGameDetails,
} from "./providers/game-provider.types";
import { IgdbProvider } from "./providers/igdb.provider";

// A cached game referenced by users is refreshed at most once a day.
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

// Same bound as the media refresh: a catalog bigger than this is caught up
// over the next runs, most stale first. IGDB serves them 500 per query.
const MAX_REFRESHED_PER_RUN = 500;

// Games persisted in parallel once a batch is fetched — each is a handful of
// writes, bounded so a full run can't empty the connection pool.
const PERSIST_CONCURRENCY = 3;

@Injectable()
export class GameItemService {
  private readonly logger = new Logger(GameItemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly igdbProvider: IgdbProvider,
    private readonly jobRuns: JobRunService,
    private readonly sagas: GameSagaService,
  ) {}

  /**
   * Every 6h, like the media refresh: re-sync tracked (non-dropped) games
   * whose cache is stale. The Twitch developer agreement IGDB runs under asks
   * for stored data to be kept up to date, and the times to beat drift as
   * players submit theirs — before this, a game was only ever refreshed when
   * someone re-added it.
   */
  @Cron(CronExpression.EVERY_6_HOURS, { name: JOB_KEYS.GAMES_REFRESH_STALE })
  async refreshStale(): Promise<number> {
    return this.jobRuns.record(
      JOB_KEYS.GAMES_REFRESH_STALE,
      () => this.runRefreshStale(),
      (refreshed) =>
        refreshed > 0
          ? `${refreshed} game item(s) refreshed`
          : "Nothing to refresh",
    );
  }

  private async runRefreshStale(): Promise<number> {
    const staleBefore = new Date(Date.now() - SYNC_TTL_MS);
    const items = await this.prisma.gameItem.findMany({
      where: {
        lastSyncedAt: { lt: staleBefore },
        entries: { some: { status: { not: "DROPPED" } } },
      },
      orderBy: { lastSyncedAt: "asc" },
      take: MAX_REFRESHED_PER_RUN,
      include: { externalIds: true },
    });
    const sourceIds = items.flatMap(
      (item) =>
        item.externalIds.find((ext) => ext.source === item.canonicalSource)
          ?.externalId ?? [],
    );
    if (sourceIds.length === 0) return 0;

    // Batched rather than upsertFromSource per game: two IGDB queries per
    // 500 games instead of two per game, under a 4 requests/second cap.
    const details = await this.igdbProvider.getDetailsByIds(sourceIds);
    const outcomes = await mapWithConcurrency(
      details,
      PERSIST_CONCURRENCY,
      async (detail): Promise<boolean> => {
        try {
          await this.persistDetails(detail.summary.source, detail);
          // Re-reading a tracked game's series is how a newly announced
          // game in it is noticed (see the sequel alert).
          await this.sagas
            .sync(detail.summary.sourceId)
            .catch((err) =>
              this.logger.warn(
                `Saga sync failed for IGDB game ${detail.summary.sourceId}`,
                err,
              ),
            );
          return true;
        } catch (err) {
          this.logger.error(
            `Refresh failed for IGDB game ${detail.summary.sourceId}`,
            err,
          );
          return false;
        }
      },
    );

    return outcomes.filter(Boolean).length;
  }

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
      releaseDatePrecision: details.releaseDatePrecision,
      upcoming: isGameUpcoming(
        details.releaseDate?.slice(0, 10) ?? null,
        details.releaseDatePrecision,
      ),
      website: details.website,
      similarGames: details.similarGames,
      developers: details.developers,
      publishers: details.publishers,
      gameModes: details.gameModes,
      playerPerspectives: details.playerPerspectives,
      franchiseGames: details.franchiseGames,
      franchiseName: details.franchiseName,
      ratings: details.ratings,
      storyline: details.storyline,
      trailerVideoId: details.trailerVideoId,
      ageRatingImageUrls: details.ageRatingImageUrls,
      multiplayerModes: details.multiplayerModes,
      timeToBeat: details.timeToBeat,
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
      releaseDatePrecision: details.releaseDatePrecision,
      genres: details.genres,
      platforms: details.platforms,
      timeToBeatHastilyMin: details.timeToBeat?.hastilyMin ?? null,
      timeToBeatNormallyMin: details.timeToBeat?.normallyMin ?? null,
      timeToBeatCompletelyMin: details.timeToBeat?.completelyMin ?? null,
      timeToBeatSubmissions: details.timeToBeat?.submissions ?? null,
      isAdult: details.summary.isAdult,
      lastSyncedAt: new Date(),
    };
  }
}
