import type {
  MusicDetailDto,
  MusicEntryDto,
  MusicItemDto,
  MusicSource,
  PagedResult,
} from "@loomkeep/shared";
import {
  Domain,
  MusicStatus,
  ReviewTargetType,
  XpReason,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type {
  MusicStatus as DbMusicStatus,
  MusicExternalId,
  MusicItem,
  Prisma,
} from "@prisma/client";
import { toDateOrNull } from "../common/date.util";
import type {
  EntryStatusChange,
  ListEntriesFilters,
} from "../common/entry-lifecycle.util";
import {
  assertEntryOwnership,
  awardNewEntryXp,
  emitEntryActivity,
  listEntryPage,
  polymorphicTargetCleanup,
  RECENTLY_UPDATED_FIRST,
  searchTerm,
  titleContains,
} from "../common/entry-lifecycle.util";
import { canonicalExternalId } from "../common/external-id.util";
import { compareTitles, timeMs } from "../common/sort.util";
import { EventsGateway } from "../events/events.gateway";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
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

type MusicSortKey =
  "added" | "title" | "artist" | "rating" | "finished" | "status";
const MUSIC_SORT_KEYS = [
  "added",
  "title",
  "artist",
  "rating",
  "finished",
  "status",
] as const satisfies readonly MusicSortKey[];
const MUSIC_STATUS_SORT_ORDER = ["TO_LISTEN", "LISTENED"] as const;

/** What ranking an album entry reads — a light slice of its DTO. */
type MusicRow = Pick<
  MusicEntryDto,
  "id" | "status" | "rating" | "finishedAt" | "createdAt"
> & { album: Pick<MusicItemDto, "title" | "artists"> };

const MUSIC_ROW_SELECT = {
  id: true,
  musicItemId: true,
  status: true,
  finishedAt: true,
  createdAt: true,
  musicItem: { select: { title: true, artists: true } },
} satisfies Prisma.MusicEntrySelect;

// The sorts on a stored column, which Postgres pages itself. Unset dates go
// last in the natural (newest first) order, where `timeMs` ranks them.
const MUSIC_SQL_SORTS: Partial<
  Record<
    MusicSortKey,
    (asc: boolean) => Prisma.MusicEntryOrderByWithRelationInput[]
  >
> = {
  added: (asc) => [{ createdAt: asc ? "asc" : "desc" }],
  finished: (asc) => [
    {
      finishedAt: { sort: asc ? "asc" : "desc", nulls: asc ? "first" : "last" },
    },
  ],
};

// Base comparator per criterion (its natural order); `order: "asc"` negates it.
function compareMusicEntries(
  sort: MusicSortKey,
  a: MusicRow,
  b: MusicRow,
  locale: string | undefined,
): number {
  switch (sort) {
    case "title":
      return compareTitles(a.album.title, b.album.title, locale);
    case "artist":
      return compareTitles(
        a.album.artists[0] ?? "",
        b.album.artists[0] ?? "",
        locale,
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
    private readonly xp: XpService,
    private readonly events: EventsGateway,
  ) {}

  /** Emits the status milestone + FAVORITED events for a music entry write. */
  private emitEntryActivity(
    userId: string,
    musicItemId: string,
    change: EntryStatusChange,
  ): Promise<void> {
    return emitEntryActivity(
      this.activity,
      {
        userId,
        domain: Domain.MUSIC,
        targetType: ReviewTargetType.MUSIC,
        targetId: musicItemId,
      },
      change,
    );
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

    if (before === null) {
      await awardNewEntryXp(this.xp, {
        userId,
        entryId: entry.id,
        domain: Domain.MUSIC,
        countEntries: () => this.prisma.musicEntry.count({ where: { userId } }),
      });
    }

    if (
      before?.status !== MusicStatus.LISTENED &&
      entry.status === MusicStatus.LISTENED
    ) {
      await this.xp.award(userId, XpReason.ALBUM_LISTENED, entry.id);
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MUSIC,
        musicItem.id,
        dto.rating,
      );
    }

    // add_title/mark_complete are two of the onboarding checklist's steps
    // (see OnboardingService) — pushed unconditionally rather than checking
    // whether onboarding is even still in progress first, since that check
    // would cost as much as the emit is worth avoiding.
    this.events.emitToUser(userId, "onboarding-updated");

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
    const q = searchTerm(filters);
    const where: Prisma.MusicEntryWhereInput = {
      userId,
      status:
        filters.statuses && filters.statuses.length > 0
          ? { in: filters.statuses as DbMusicStatus[] }
          : undefined,
      favorite: filters.favorite ? true : undefined,
      musicItem: q ? { title: titleContains(q) } : undefined,
    };
    const ratingsOf = (musicItemIds: string[]) =>
      this.reviews.getRatings(userId, ReviewTargetType.MUSIC, musicItemIds);

    return listEntryPage(filters, {
      sortKeys: MUSIC_SORT_KEYS,
      defaultSort: "added",
      compare: compareMusicEntries,
      sqlSorts: MUSIC_SQL_SORTS,
      sqlPage: async (orderBy, skip, take) => {
        const [page, total] = await Promise.all([
          this.prisma.musicEntry.findMany({
            where,
            orderBy: [...orderBy, ...RECENTLY_UPDATED_FIRST],
            skip,
            take,
            select: { id: true },
          }),
          this.prisma.musicEntry.count({ where }),
        ]);
        return { ids: page.map((e) => e.id), total };
      },
      rows: async (sort) => {
        const rows = await this.prisma.musicEntry.findMany({
          where,
          orderBy: RECENTLY_UPDATED_FIRST,
          select: MUSIC_ROW_SELECT,
        });
        const ratings =
          sort === "rating"
            ? await ratingsOf(rows.map((r) => r.musicItemId))
            : new Map<string, number>();
        return rows.map((r) => ({
          id: r.id,
          status: r.status,
          rating: ratings.get(r.musicItemId) ?? null,
          finishedAt: r.finishedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          album: { title: r.musicItem.title, artists: r.musicItem.artists },
        }));
      },
      load: async (ids) => {
        const entries = await this.prisma.musicEntry.findMany({
          where: { id: { in: ids } },
          include: ENTRY_INCLUDE,
        });
        const ratings = await ratingsOf(entries.map((e) => e.musicItemId));
        return entries.map((e) =>
          toEntryDto(e, ratings.get(e.musicItemId) ?? null),
        );
      },
    });
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

    if (
      before?.status !== MusicStatus.LISTENED &&
      entry.status === MusicStatus.LISTENED
    ) {
      await this.xp.award(userId, XpReason.ALBUM_LISTENED, entry.id);
    }

    if (dto.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MUSIC,
        entry.musicItemId,
        dto.rating,
      );
    }

    this.events.emitToUser(userId, "onboarding-updated");

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

    // Loaded before the transaction — it deletes this Review outright (not
    // via ReviewService, which handles its own XP revocation) —
    // WORK_RATED/REVIEW_WRITTEN/REVIEW_DETAILED would otherwise linger
    // until the next nightly reconciliation.
    const reviews = await this.prisma.review.findMany({
      where: { userId, targetId: entry.musicItemId },
      select: { id: true },
    });

    await this.prisma.$transaction([
      ...polymorphicTargetCleanup(this.prisma, userId, [entry.musicItemId]),
      this.prisma.musicEntry.delete({ where: { id: entryId } }),
    ]);

    await this.xp.revokeBySource("MusicEntry", [entryId]); // ALBUM_LISTENED
    await this.xp.revokeBySource("Entry", [entryId]); // WORK_ADDED
    await this.xp.revokeBySource(
      "Review",
      reviews.map((r) => r.id),
    ); // WORK_RATED / REVIEW_WRITTEN / REVIEW_DETAILED
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
      commentTargetId: ref?.musicItemId ?? null,
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

  private assertEntryOwnership(userId: string, entryId: string) {
    return assertEntryOwnership(userId, () =>
      this.prisma.musicEntry.findUnique({ where: { id: entryId } }),
    );
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
