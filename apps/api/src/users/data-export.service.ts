import { Injectable, NotFoundException } from "@nestjs/common";
import type { UserDataExportDto } from "@loomkeep/shared";
import { ReviewTargetType } from "@loomkeep/shared";
import { toUserDto } from "../auth/auth.service";
import {
  canonicalExternalId,
  toExternalIdDtos,
} from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";

/**
 * Builds the full portable data dump (GDPR "download my data"). Shared by the
 * self-service export (`UsersController.exportData`, always the caller's own
 * account) and the admin-triggered export (`AdminUsersController`, any account) so
 * the two never drift out of sync.
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewService,
  ) {}

  async buildExport(userId: string): Promise<UserDataExportDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [
      entries,
      watches,
      gameEntries,
      bookEntries,
      musicEntries,
      notifications,
    ] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        where: { userId },
        include: { mediaItem: { include: { externalIds: true } } },
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
      this.prisma.gameEntry.findMany({
        where: { userId },
        include: {
          gameItem: { include: { externalIds: true } },
          replays: { orderBy: { finishedAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.bookEntry.findMany({
        where: { userId },
        include: {
          bookItem: { include: { externalIds: true } },
          replays: { orderBy: { finishedAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.musicEntry.findMany({
        where: { userId },
        include: { musicItem: { include: { externalIds: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Ratings now live in Review; project them back into the export.
    const [mediaRatings, gameRatings, bookRatings, musicRatings] =
      await Promise.all([
        this.reviews.getRatings(
          userId,
          ReviewTargetType.MEDIA,
          entries.map((e) => e.mediaItemId),
        ),
        this.reviews.getRatings(
          userId,
          ReviewTargetType.GAME,
          gameEntries.map((e) => e.gameItemId),
        ),
        this.reviews.getRatings(
          userId,
          ReviewTargetType.BOOK,
          bookEntries.map((e) => e.bookItemId),
        ),
        this.reviews.getRatings(
          userId,
          ReviewTargetType.MUSIC,
          musicEntries.map((e) => e.musicItemId),
        ),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      account: toUserDto(user),
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
        rating: mediaRatings.get(entry.mediaItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
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
          watchedAt: watch.watchedAt.toISOString(),
        };
      }),
      games: gameEntries.map((entry) => ({
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
        rating: gameRatings.get(entry.gameItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        playtimeMinutes: entry.playtimeMinutes,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: entry.replays.map((r) => r.finishedAt.toISOString()),
      })),
      books: bookEntries.map((entry) => ({
        book: {
          title: entry.bookItem.title,
          authors: entry.bookItem.authors,
          canonicalSource: entry.bookItem.canonicalSource,
          sourceId: canonicalExternalId(
            entry.bookItem,
            entry.bookItem.externalIds,
          ),
          externalIds: toExternalIdDtos(entry.bookItem.externalIds),
        },
        status: entry.status,
        rating: bookRatings.get(entry.bookItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        currentPage: entry.currentPage,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        replays: entry.replays.map((r) => r.finishedAt.toISOString()),
      })),
      music: musicEntries.map((entry) => ({
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
        rating: musicRatings.get(entry.musicItemId) ?? null,
        notes: entry.notes,
        favorite: entry.favorite,
        ownershipStatus: entry.ownershipStatus,
        ownershipSource: entry.ownershipSource,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
      // Reserved keys for the planned podcasts/board-games domains — no backing
      // tables yet, so always empty (keeps the export shape stable ahead of P3).
      podcasts: [],
      boardGames: [],
      notifications: notifications.map((n) => ({
        type: n.type,
        title: n.title,
        body: n.body,
        url: n.url,
        data: (n.data ?? {}) as Record<string, unknown>,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }
}
