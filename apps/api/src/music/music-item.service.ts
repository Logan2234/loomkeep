import { Injectable } from "@nestjs/common";
import type { MusicItem } from "@prisma/client";
import type {
  MusicDetailsDto,
  MusicSource,
  MusicSummaryDto,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MusicBrainzProvider } from "./providers/musicbrainz.provider";
import type {
  MusicCatalogProvider,
  ProviderMusicDetails,
} from "./providers/music-provider.types";

// A cached album referenced by users is refreshed at most once a day.
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MusicItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly musicBrainzProvider: MusicBrainzProvider,
  ) {}

  /** MusicBrainz is the only source today. */
  providerFor(): MusicCatalogProvider {
    return this.musicBrainzProvider;
  }

  /** Free-text catalogue search. */
  async search(query: string): Promise<MusicSummaryDto[]> {
    return this.musicBrainzProvider.search(query).catch(() => []);
  }

  /** Live details straight from the provider — nothing is persisted. */
  async getLiveDetails(
    source: MusicSource,
    sourceId: string,
  ): Promise<MusicDetailsDto> {
    const details = await this.providerFor().getDetails(sourceId);
    return {
      ...details.summary,
      genres: details.genres,
      albumType: details.albumType,
      trackCount: details.trackCount,
      releaseDate: details.releaseDate,
      releaseDatePrecision: details.releaseDatePrecision,
      sameArtistAlbums: details.sameArtistAlbums,
      tags: details.tags,
      disambiguation: details.disambiguation,
      externalLinks: details.externalLinks,
      label: details.label,
      catalogNumber: details.catalogNumber,
      tracks: details.tracks,
      totalDurationMs: details.totalDurationMs,
      extraCoverImages: details.extraCoverImages,
    };
  }

  /**
   * On-demand cache entry point: called when a user starts referencing an
   * album. Fetches from the canonical source and persists it with its
   * external IDs. Throttled by lastSyncedAt (24h TTL).
   */
  async upsertFromSource(
    source: MusicSource,
    sourceId: string,
  ): Promise<MusicItem> {
    const existingRef = await this.prisma.musicExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
      include: { musicItem: true },
    });

    if (
      existingRef &&
      Date.now() - existingRef.musicItem.lastSyncedAt.getTime() < SYNC_TTL_MS
    ) {
      return existingRef.musicItem;
    }

    const details = await this.providerFor().getDetails(sourceId);
    return this.persistDetails(source, details);
  }

  /**
   * Persist an album from details already fetched from the provider (create
   * or refresh).
   */
  async persistDetails(
    source: MusicSource,
    details: ProviderMusicDetails,
  ): Promise<MusicItem> {
    const canonicalId = details.externalIds.find(
      (ext) => ext.source === source,
    )?.externalId;

    if (!canonicalId) {
      throw new Error(`Provider details for ${source} carry no ${source} id`);
    }

    const existingRef = await this.prisma.musicExternalId.findUnique({
      where: { source_externalId: { source, externalId: canonicalId } },
    });
    return existingRef
      ? this.refresh(existingRef.musicItemId, details)
      : this.createFresh(source, details);
  }

  /** Admin-triggered re-sync: refetches from the canonical source, bypassing the TTL. */
  async forceRefresh(musicItemId: string): Promise<MusicItem> {
    const item = await this.prisma.musicItem.findUniqueOrThrow({
      where: { id: musicItemId },
      include: { externalIds: true },
    });
    const sourceId = item.externalIds.find(
      (ext) => ext.source === item.canonicalSource,
    )?.externalId;

    if (!sourceId) {
      throw new Error(`Album ${musicItemId} has no ${item.canonicalSource} id`);
    }

    const details = await this.providerFor().getDetails(sourceId);
    return this.persistDetails(item.canonicalSource as MusicSource, details);
  }

  private async createFresh(
    source: MusicSource,
    details: ProviderMusicDetails,
  ): Promise<MusicItem> {
    return this.prisma.musicItem.create({
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
    musicItemId: string,
    details: ProviderMusicDetails,
  ): Promise<MusicItem> {
    const item = await this.prisma.musicItem.update({
      where: { id: musicItemId },
      data: this.baseFields(details),
    });

    for (const ext of details.externalIds) {
      await this.prisma.musicExternalId.upsert({
        where: {
          source_externalId: { source: ext.source, externalId: ext.externalId },
        },
        update: { musicItemId },
        create: { musicItemId, source: ext.source, externalId: ext.externalId },
      });
    }

    return item;
  }

  private baseFields(details: ProviderMusicDetails) {
    return {
      title: details.summary.title,
      artists: details.summary.artists,
      coverUrl: details.summary.coverUrl,
      releaseDate: details.releaseDate ? new Date(details.releaseDate) : null,
      genres: details.genres,
      albumType: details.albumType,
      trackCount: details.trackCount,
      durationMin: details.totalDurationMs
        ? Math.round(details.totalDurationMs / 60_000)
        : null,
      lastSyncedAt: new Date(),
    };
  }
}
