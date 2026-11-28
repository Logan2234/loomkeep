import {
  type MusicOwnershipStatus,
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
import { csvDate, itemHref } from "../work/entry-export.util";
import { LOAN_INCLUDE, loanFields } from "../work/entry-loan.util";
import { bucketizeMusicStatus } from "../work/status-bucket.util";
import type { DataExportMusicEntry } from "./music-export.types";

/** The music library, as the modules that read every domain see it. */
@Injectable()
export class MusicDomainAdapter implements DomainAdapter<"MUSIC"> {
  readonly domain = "MUSIC";
  readonly reviewTargetType = ReviewTargetType.MUSIC;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
  ) {}

  countEntries(userId: string): Promise<number> {
    return this.prisma.musicEntry.count({ where: { userId } });
  }

  async libraryRows(userId: string): Promise<LibraryRow[]> {
    const entries = await this.prisma.musicEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        ownershipStatus: true,
        musicItem: {
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
      bucket: bucketizeMusicStatus(e.status),
      favorite: e.favorite,
      ownershipStatus: e.ownershipStatus,
      releaseDate: e.musicItem.releaseDate,
      itemId: e.musicItem.id,
      title: e.musicItem.title,
      imageUrl: e.musicItem.coverUrl,
      href: itemHref("music", e.musicItem),
    }));
  }

  async itemTitles(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const items = await this.prisma.musicItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    return new Map(items.map((i) => [i.id, i.title]));
  }

  async exportEntries(
    userId: string,
  ): Promise<{ music: DataExportMusicEntry[] }> {
    const entries = await this.prisma.musicEntry.findMany({
      where: { userId },
      include: {
        musicItem: { include: { externalIds: true } },
        ...LOAN_INCLUDE,
      },
      orderBy: { createdAt: "asc" },
    });
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.MUSIC,
      entries.map((e) => e.musicItemId),
    );

    return {
      music: entries.map((entry) => ({
        album: {
          title: entry.musicItem.title,
          artists: entry.musicItem.artists,
          canonicalSource: entry.musicItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.musicItem,
            entry.musicItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.musicItem.externalIds),
        },
        status: entry.status,
        rating: ratings.get(entry.musicItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        ownershipStatus: entry.ownershipStatus as MusicOwnershipStatus,
        ownershipSource: entry.ownershipSource,
        ...loanFields(entry),
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async exportCsv(userId: string): Promise<string> {
    const entries = await this.prisma.musicEntry.findMany({
      where: { userId },
      include: { musicItem: true },
      orderBy: { createdAt: "asc" },
    });
    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.MUSIC,
      entries.map((e) => e.musicItemId),
    );

    return toCsv([
      [
        "Title",
        "Artists",
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
        e.musicItem.title,
        e.musicItem.artists.join("; "),
        e.status,
        ratings.get(e.musicItemId) ?? null,
        e.notes,
        e.favorite ? "true" : "false",
        csvDate(e.startedAt),
        csvDate(e.finishedAt),
        e.ownershipStatus,
        e.ownershipSource,
        csvDate(e.musicItem.releaseDate),
        e.musicItem.genres.join("; "),
      ]),
    ]);
  }
}
