import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { MediaItem } from "@prisma/client";
import type {
  CatalogSource,
  MediaDetailsDto,
  MediaType,
} from "@loomkeep/shared";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnilistProvider } from "./providers/anilist.provider";
import type {
  CatalogProvider,
  ProviderMediaDetails,
} from "./providers/provider.types";
import { TmdbProvider } from "./providers/tmdb.provider";

// A cached media referenced by users is refreshed at most once a day.
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MediaItemService {
  private readonly logger = new Logger(MediaItemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdbProvider: TmdbProvider,
    private readonly anilistProvider: AnilistProvider,
    private readonly jobRuns: JobRunService,
  ) {}

  /**
   * Every 6h: re-sync tracked (non-dropped) media whose cache is stale, so
   * newly announced episodes reach the DB before the notification scan looks
   * for them. One upsert per distinct MediaItem, regardless of follower count.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async refreshStale(): Promise<number> {
    return this.jobRuns.record(
      JOB_KEYS.MEDIA_REFRESH_STALE,
      () => this.runRefreshStale(),
      (refreshed) =>
        refreshed > 0
          ? `${refreshed} média(s) rafraîchi(s)`
          : "Rien à rafraîchir",
    );
  }

  private async runRefreshStale(): Promise<number> {
    const staleBefore = new Date(Date.now() - SYNC_TTL_MS);
    const items = await this.prisma.mediaItem.findMany({
      where: {
        lastSyncedAt: { lt: staleBefore },
        entries: { some: { status: { not: "DROPPED" } } },
      },
      include: { externalIds: true },
    });

    let refreshed = 0;

    for (const item of items) {
      const sourceId = item.externalIds.find(
        (ext) => ext.source === item.canonicalSource,
      )?.externalId;
      if (!sourceId) continue;

      try {
        await this.upsertFromSource(
          item.canonicalSource as CatalogSource,
          sourceId,
          item.type as MediaType,
        );
        refreshed++;
      } catch (err) {
        this.logger.error(`Refresh failed for media ${item.id}`, err);
      }
    }

    if (refreshed > 0) {
      this.logger.log(
        `Refreshed ${refreshed}/${items.length} stale media item(s)`,
      );
    }

    return refreshed;
  }

  /** Admin-triggered re-sync: refetches from the canonical source, bypassing the TTL. */
  async forceRefresh(mediaItemId: string): Promise<MediaItem> {
    const item = await this.prisma.mediaItem.findUniqueOrThrow({
      where: { id: mediaItemId },
      include: { externalIds: true },
    });
    const sourceId = item.externalIds.find(
      (ext) => ext.source === item.canonicalSource,
    )?.externalId;

    if (!sourceId) {
      throw new Error(`Media ${mediaItemId} has no ${item.canonicalSource} id`);
    }

    const details = await this.providerFor(
      item.canonicalSource as CatalogSource,
    ).getDetails(sourceId, item.type as MediaType);
    return this.refresh(mediaItemId, item.type as MediaType, details);
  }

  providerFor(source: CatalogSource): CatalogProvider {
    return source === "TMDB" ? this.tmdbProvider : this.anilistProvider;
  }

  /** Live details straight from the provider — nothing is persisted. */
  async getLiveDetails(
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
  ): Promise<MediaDetailsDto> {
    const details = await this.providerFor(source).getDetails(sourceId, type);
    return {
      ...details.summary,
      overview: details.overview,
      backdropUrl: details.backdropUrl,
      genres: details.genres,
      status: details.status,
      seasons: details.seasons.map((season) => ({
        id: null,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({ id: null, ...episode })),
      })),
    };
  }

  /**
   * On-demand cache entry point: called when a user starts referencing a media
   * (track, wishlist…). Fetches from the canonical source and persists the
   * media with its external IDs, seasons and episodes.
   */
  async upsertFromSource(
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
  ): Promise<MediaItem> {
    const existingRef = await this.prisma.mediaExternalId.findUnique({
      where: {
        source_externalId_type: {
          source: source,
          externalId: sourceId,
          type: type,
        },
      },
      include: { mediaItem: true },
    });

    if (
      existingRef &&
      Date.now() - existingRef.mediaItem.lastSyncedAt.getTime() < SYNC_TTL_MS
    ) {
      return existingRef.mediaItem;
    }

    const details = await this.providerFor(source).getDetails(sourceId, type);
    return existingRef
      ? this.refresh(existingRef.mediaItemId, type, details)
      : this.createFresh(source, type, details);
  }

  private async createFresh(
    source: CatalogSource,
    type: MediaType,
    details: ProviderMediaDetails,
  ): Promise<MediaItem> {
    return this.prisma.mediaItem.create({
      data: {
        ...this.baseFields(details),
        type: type,
        canonicalSource: source,
        externalIds: {
          create: details.externalIds.map((ext) => ({
            source: ext.source,
            externalId: ext.externalId,
            type,
          })),
        },
        seasons: {
          create: details.seasons.map((season) => ({
            number: season.number,
            title: season.title,
            episodes: {
              create: season.episodes.map((episode) => ({
                number: episode.number,
                title: episode.title,
                airDate: episode.airDate ? new Date(episode.airDate) : null,
              })),
            },
          })),
        },
      },
    });
  }

  private async refresh(
    mediaItemId: string,
    type: MediaType,
    details: ProviderMediaDetails,
  ): Promise<MediaItem> {
    const item = await this.prisma.mediaItem.update({
      where: { id: mediaItemId },
      data: this.baseFields(details),
    });

    for (const ext of details.externalIds) {
      await this.prisma.mediaExternalId.upsert({
        where: {
          source_externalId_type: {
            source: ext.source,
            externalId: ext.externalId,
            type,
          },
        },
        update: { mediaItemId },
        create: {
          mediaItemId,
          source: ext.source,
          externalId: ext.externalId,
          type,
        },
      });
    }

    // Upsert (never delete) so episode watches always keep a valid target,
    // even if the source reorganises its listing.
    for (const season of details.seasons) {
      const storedSeason = await this.prisma.season.upsert({
        where: { mediaItemId_number: { mediaItemId, number: season.number } },
        update: { title: season.title },
        create: { mediaItemId, number: season.number, title: season.title },
      });

      for (const episode of season.episodes) {
        const airDate = episode.airDate ? new Date(episode.airDate) : null;
        await this.prisma.episode.upsert({
          where: {
            seasonId_number: {
              seasonId: storedSeason.id,
              number: episode.number,
            },
          },
          update: { title: episode.title, airDate },
          create: {
            seasonId: storedSeason.id,
            number: episode.number,
            title: episode.title,
            airDate,
          },
        });
      }
    }

    return item;
  }

  private baseFields(details: ProviderMediaDetails) {
    return {
      title: details.summary.title,
      posterUrl: details.summary.posterUrl,
      backdropUrl: details.backdropUrl,
      overview: details.overview,
      releaseDate: details.releaseDate ? new Date(details.releaseDate) : null,
      status: details.status,
      genres: details.genres,
      runtimeMin: details.runtimeMin,
      isAdult: details.summary.isAdult,
      lastSyncedAt: new Date(),
    };
  }
}
