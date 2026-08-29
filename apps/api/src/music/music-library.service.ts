import type {
  MusicDetailDto,
  MusicEntryDto,
  MusicItemDto,
  MusicSource,
  PagedResult,
} from "@loomkeep/shared";
import { ActivityType, ErrorCode, ReviewTargetType } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  MusicStatus as DbMusicStatus,
  MusicEntry,
  MusicExternalId,
  MusicItem,
  Prisma,
} from "@prisma/client";
import { AppException } from "../common/app.exception";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { classifyStatusTransition } from "../social/activity-transition.util";
import { ActivityService } from "../social/activity.service";
import { UpdateMusicEntryDto } from "./dto/update-music-entry.dto";
import { UpsertMusicEntryDto } from "./dto/upsert-music-entry.dto";
import { MusicItemService } from "./music-item.service";

// Entries always need the album + its external IDs (canonical sourceId).
const ENTRY_INCLUDE = {
  musicItem: { include: { externalIds: true } },
} satisfies Prisma.MusicEntryInclude;

type EntryWithAlbum = Prisma.MusicEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

const PAGE_SIZE = 40;

type MusicSortKey =
  "added" | "title" | "artist" | "rating" | "finished" | "status";
const MUSIC_SORT_KEYS: MusicSortKey[] = [
  "added",
  "title",
  "artist",
  "rating",
  "finished",
  "status",
];
const MUSIC_STATUS_SORT_ORDER = ["TO_LISTEN", "LISTENED"] as const;

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
function compareMusicEntries(
  sort: MusicSortKey,
  a: MusicEntryDto,
  b: MusicEntryDto,
): number {
  switch (sort) {
    case "title":
      return a.album.title.localeCompare(b.album.title, "fr");
    case "artist":
      return (a.album.artists[0] ?? "").localeCompare(
        b.album.artists[0] ?? "",
        "fr",
      );
    case "rating":
      return (b.rating ?? -1) - (a.rating ?? -1);
    case "finished":
      return timeMs(b.finishedAt) - timeMs(a.finishedAt);
    case "status":
      return (
        MUSIC_STATUS_SORT_ORDER.indexOf(a.status) -
        MUSIC_STATUS_SORT_ORDER.indexOf(b.status)
      );
    case "added":
      return b.createdAt.localeCompare(a.createdAt);
  }
}

@Injectable()
export class MusicLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly musicItemService: MusicItemService,
    private readonly reviews: ReviewService,
    private readonly activity: ActivityService,
  ) {}

  /** Emits the status milestone + FAVORITED events for a music entry write. */
  private async emitEntryActivity(
    userId: string,
    musicItemId: string,
    change: {
      prevStatus: string | null;
      nextStatus: string;
      prevFavorite: boolean;
      nextFavorite: boolean;
    },
  ): Promise<void> {
    const transition = classifyStatusTransition(
      "MUSIC",
      change.prevStatus,
      change.nextStatus,
    );

    if (transition) {
      await this.activity.emit({
        userId,
        type: transition.type,
        domain: "MUSIC",
        targetType: ReviewTargetType.MUSIC,
        targetId: musicItemId,
        homeFeed: transition.homeFeed,
      });
    }

    if (change.nextFavorite && !change.prevFavorite) {
      await this.activity.emit({
        userId,
        type: ActivityType.FAVORITED,
        domain: "MUSIC",
        targetType: ReviewTargetType.MUSIC,
        targetId: musicItemId,
        homeFeed: false,
      });
    }
  }

  /** First touch of an album persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertMusicEntryDto,
  ): Promise<MusicEntryDto> {
    const musicItem = await this.musicItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
    );

    const before = await this.prisma.musicEntry.findUnique({
      where: { userId_musicItemId: { userId, musicItemId: musicItem.id } },
      select: { status: true, favorite: true },
    });

    const changes = {
      status: dto.status,
      notes: dto.notes,
      favorite: dto.favorite,
    };
    const entry = await this.prisma.musicEntry.upsert({
      where: { userId_musicItemId: { userId, musicItemId: musicItem.id } },
      update: changes,
      create: { userId, musicItemId: musicItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    await this.emitEntryActivity(userId, musicItem.id, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MUSIC,
        musicItem.id,
        dto.rating,
      );
    }

    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MUSIC,
        musicItem.id,
      ),
    );
  }

  async listEntries(
    userId: string,
    filters: ListEntriesFilters,
  ): Promise<PagedResult<MusicEntryDto>> {
    const entries = await this.prisma.musicEntry.findMany({
      where: {
        userId,
        status:
          filters.statuses && filters.statuses.length > 0
            ? { in: filters.statuses as DbMusicStatus[] }
            : undefined,
      },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const ratings = await this.reviews.getRatings(
      userId,
      ReviewTargetType.MUSIC,
      entries.map((e) => e.musicItemId),
    );
    let dtos = entries.map((e) =>
      toEntryDto(e, ratings.get(e.musicItemId) ?? null),
    );

    const q = filters.q?.trim().toLowerCase();
    dtos = dtos.filter((dto) => {
      if (filters.favorite && !dto.favorite) return false;
      if (q && !dto.album.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const sort = MUSIC_SORT_KEYS.includes(filters.sort as MusicSortKey)
      ? (filters.sort as MusicSortKey)
      : "added";
    const asc = filters.order === "asc";
    dtos.sort((a, b) => {
      const c = compareMusicEntries(sort, a, b);
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

  async getEntry(userId: string, entryId: string): Promise<MusicEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.musicEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MUSIC,
        entry.musicItemId,
      ),
    );
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateMusicEntryDto,
  ): Promise<MusicEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const before = await this.prisma.musicEntry.findUnique({
      where: { id: entryId },
      select: { status: true, favorite: true },
    });

    const entry = await this.prisma.musicEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        notes: dto.notes,
        favorite: dto.favorite,
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

    await this.emitEntryActivity(userId, entry.musicItemId, {
      prevStatus: before?.status ?? null,
      nextStatus: entry.status,
      prevFavorite: before?.favorite ?? false,
      nextFavorite: entry.favorite,
    });

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MUSIC,
        entry.musicItemId,
        dto.rating,
      );
    }

    return toEntryDto(
      entry,
      await this.reviews.getRating(
        userId,
        ReviewTargetType.MUSIC,
        entry.musicItemId,
      ),
    );
  }

  /**
   * `Review`/`Comment` are polymorphic (targetType/targetId, no FK) so they
   * never cascaded on entry removal — same bug class as MEDIA's
   * `deleteEntry` had before commit `0db5dc6` fixed it there. Music has no
   * replay/reread concept, so no third table to clean up here.
   */
  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.assertEntryOwnership(userId, entryId);

    await this.prisma.$transaction([
      this.prisma.review.deleteMany({
        where: { userId, targetId: entry.musicItemId },
      }),
      this.prisma.comment.updateMany({
        where: {
          authorId: userId,
          targetId: entry.musicItemId,
          deletedAt: null,
        },
        data: { text: null, deletedAt: new Date() },
      }),
      this.prisma.musicEntry.delete({ where: { id: entryId } }),
    ]);
  }

  /**
   * Album detail page: catalogue metadata + the user's library state in one
   * call. Served from the cache when the album is already persisted,
   * otherwise fetched live (persisting nothing — a previewed album must not
   * enter the on-demand cache).
   */
  async getMusicDetail(
    userId: string,
    source: MusicSource,
    sourceId: string,
  ): Promise<MusicDetailDto> {
    const details = await this.musicItemService.getLiveDetails(
      source,
      sourceId,
    );

    const ref = await this.prisma.musicExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
    });
    const entryRow = ref
      ? await this.prisma.musicEntry.findUnique({
          where: {
            userId_musicItemId: { userId, musicItemId: ref.musicItemId },
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
              ReviewTargetType.MUSIC,
              entryRow.musicItemId,
            ),
          )
        : null,
    };
  }

  private async assertEntryOwnership(
    userId: string,
    entryId: string,
  ): Promise<MusicEntry> {
    const entry = await this.prisma.musicEntry.findUnique({
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

function toMusicItemDto(
  album: MusicItem & { externalIds: MusicExternalId[] },
): MusicItemDto {
  return {
    id: album.id,
    title: album.title,
    artists: album.artists,
    coverUrl: album.coverUrl,
    albumType: album.albumType,
    canonicalSource: album.canonicalSource,
    sourceId: canonicalExternalId(album, album.externalIds),
  };
}

function toEntryDto(
  entry: EntryWithAlbum,
  rating: number | null,
): MusicEntryDto {
  return {
    id: entry.id,
    album: toMusicItemDto(entry.musicItem),
    status: entry.status,
    rating,
    notes: entry.notes,
    favorite: entry.favorite,
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    ownershipStatus: entry.ownershipStatus,
    ownershipSource: entry.ownershipSource,
  };
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
