import { ReviewTargetType } from "@loomkeep/shared/enums";
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
import { csvDate, itemHref } from "../work/entry-export.util";
import { bucketizeEntryStatus } from "../work/status-bucket.util";
import type { DataExportEntry, DataExportWatch } from "./media-export.types";

/** The media library, as the modules that read every domain see it. */
@Injectable()
export class MediaDomainAdapter implements DomainAdapter<"MEDIA"> {
  readonly domain = "MEDIA";
  readonly reviewTargetType = ReviewTargetType.MEDIA;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
  ) {}

  countEntries(userId: string): Promise<number> {
    return this.prisma.mediaEntry.count({ where: { userId } });
  }

  async libraryRows(userId: string): Promise<LibraryRow[]> {
    const entries = await this.prisma.mediaEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        mediaItem: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            releaseDate: true,
            type: true,
            ...CANONICAL_EXTERNAL_ID_SELECT,
          },
        },
      },
    });

    return entries.map((e) => ({
      bucket: bucketizeEntryStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.mediaItem.releaseDate,
      itemId: e.mediaItem.id,
      title: e.mediaItem.title,
      imageUrl: e.mediaItem.posterUrl,
      // The one domain whose route carries the item's type as well.
      href: itemHref(`media/${e.mediaItem.type.toLowerCase()}`, e.mediaItem),
    }));
  }

  async itemTitles(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const items = await this.prisma.mediaItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    return new Map(items.map((i) => [i.id, i.title]));
  }

  async exportEntries(userId: string): Promise<{
    library: DataExportEntry[];
    episodeWatches: DataExportWatch[];
  }> {
    const [entries, watches] = await Promise.all([
      this.prisma.mediaEntry.findMany({
        where: { userId },
        include: {
          mediaItem: { include: { externalIds: true } },
          replays: { orderBy: { finishedAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.episodeWatch.findMany({
        where: { userId },
        include: {
          episode: {
            include: {
              season: {
                include: { mediaItem: { include: { externalIds: true } } },
              },
            },
          },
        },
        orderBy: { watchedAt: "asc" },
      }),
    ]);
    // Ratings live in Review; project them back into the export.
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.MEDIA,
      entries.map((e) => e.mediaItemId),
    );

    return {
      library: entries.map((entry) => ({
        media: {
          type: entry.mediaItem.type,
          title: entry.mediaItem.title,
          canonicalSource: entry.mediaItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.mediaItem,
            entry.mediaItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.mediaItem.externalIds),
        },
        status: entry.status,
        rating: ratings.get(entry.mediaItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: entry.replays.map((replay) => replay.finishedAt.toISOString()),
      })),
      episodeWatches: watches.map((watch) => {
        const media = watch.episode.season.mediaItem;
        return {
          media: {
            type: media.type,
            title: media.title,
            sourceId: canonicalExternalId(media, media.externalIds),
          },
          seasonNumber: watch.episode.season.number,
          episodeNumber: watch.episode.number,
          episodeTitle: watch.episode.title,
          watchedAt: watch.watchedAt?.toISOString() ?? null,
        };
      }),
    };
  }

  async exportCsv(userId: string): Promise<string> {
    const entries = await this.prisma.mediaEntry.findMany({
      where: { userId },
      include: { mediaItem: true },
      orderBy: { createdAt: "asc" },
    });
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.MEDIA,
      entries.map((e) => e.mediaItemId),
    );

    return toCsv([
      [
        "Title",
        "Type",
        "Status",
        "Rating",
        "Notes",
        "Favorite",
        "Started At",
        "Finished At",
        "Ownership Status",
        "Ownership Source",
        "Release Date",
        "Genres",
      ],
      ...entries.map((e) => [
        e.mediaItem.title,
        e.mediaItem.type,
        e.status,
        ratings.get(e.mediaItemId) ?? null,
        e.notes,
        e.favorite ? "true" : "false",
        csvDate(e.startedAt),
        csvDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        csvDate(e.mediaItem.releaseDate),
        e.mediaItem.genres.join("; "),
      ]),
    ]);
  }
}
