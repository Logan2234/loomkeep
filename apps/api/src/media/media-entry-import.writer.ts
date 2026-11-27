import type { EntryStatus, MediaOwnershipStatus } from "@loomkeep/shared/enums";
import type { PrismaService } from "../prisma/prisma.service";
import {
  LOAN_INCLUDE,
  loanUpdate,
  ownershipSourceUpdate,
} from "../work/entry-loan.util";

/** What an import merges into: the entry's current values, or null. */
export type ImportedMediaEntryState = Awaited<
  ReturnType<MediaEntryImportWriter["findForMerge"]>
>;

/**
 * Every write an import makes to the media tables (MediaEntry, EpisodeWatch,
 * MovieReplay), kept here beside the library module that owns them. No side
 * effect runs: an import earns its XP once, at the end (ImportJobService),
 * not per title.
 *
 * The merge rule is the same for every source: an import adds what it knows
 * and never takes anything away. The status only moves forward (the caller
 * passes the furthest one), and a date or note the entry already has stays.
 */
export class MediaEntryImportWriter {
  constructor(private readonly prisma: PrismaService) {}

  findForMerge(userId: string, mediaItemId: string) {
    return this.prisma.mediaEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      select: {
        status: true,
        notes: true,
        startedAt: true,
        finishedAt: true,
        ownershipStatus: true,
        ...LOAN_INCLUDE,
      },
    });
  }

  /** Drops the user's entry and watches of one title, which the import replaces. */
  async removeTitle(userId: string, mediaItemId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.episodeWatch.deleteMany({
        where: { userId, episode: { season: { mediaItemId } } },
      }),
      this.prisma.mediaEntry.deleteMany({ where: { userId, mediaItemId } }),
    ]);
  }

  /** Drops every entry and watch of the user's but those of `kept` titles. */
  async removeAllExcept(userId: string, kept: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.episodeWatch.deleteMany({
        where: {
          userId,
          episode: { season: { mediaItemId: { notIn: kept } } },
        },
      }),
      this.prisma.mediaEntry.deleteMany({
        where: { userId, mediaItemId: { notIn: kept } },
      }),
    ]);
  }

  /** A film: a single sitting, so it starts and finishes at `watchedAt`. */
  mergeMovie(
    userId: string,
    mediaItemId: string,
    existing: ImportedMediaEntryState,
    movie: {
      status: EntryStatus;
      watchedAt: Date | null;
      favorite: boolean;
      notes: string | null | undefined;
      addedAt: Date | null | undefined;
    },
  ) {
    return this.prisma.mediaEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      // Re-importing over an entry adds what the source knows and never
      // takes anything away: no status moved back, and no date or note the
      // entry already has replaced (the user may have corrected it here).
      update: {
        status: movie.status,
        startedAt: existing?.startedAt
          ? undefined
          : (movie.watchedAt ?? undefined),
        finishedAt: existing?.finishedAt
          ? undefined
          : (movie.watchedAt ?? undefined),
        favorite: movie.favorite ? true : undefined,
        notes: existing?.notes ? undefined : (movie.notes ?? undefined),
      },
      create: {
        userId,
        mediaItemId,
        status: movie.status,
        startedAt: movie.watchedAt,
        finishedAt: movie.watchedAt,
        favorite: movie.favorite,
        notes: movie.notes ?? null,
        // The date the user added it on the source, so "recently added" keeps
        // meaning something after an import. Only on create: an existing entry
        // already has the user's own history.
        createdAt: movie.addedAt ?? undefined,
      },
    });
  }

  /** A series or an anime, with its ownership. */
  async mergeSeries(
    userId: string,
    mediaItemId: string,
    existing: ImportedMediaEntryState,
    show: {
      status: EntryStatus;
      startedAt: Date | null;
      finishedAt: Date | null;
      favorite: boolean;
      notes: string | null | undefined;
      ownershipStatus: MediaOwnershipStatus | undefined;
      ownershipSource: string | null | undefined;
      addedAt: Date | null | undefined;
    },
  ): Promise<void> {
    await this.prisma.mediaEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId } },
      // Same rule as films: the status only moves forward, and a date is
      // written only where the entry has none.
      update: {
        status: show.status,
        startedAt: existing?.startedAt
          ? undefined
          : (show.startedAt ?? undefined),
        finishedAt: existing?.finishedAt
          ? undefined
          : (show.finishedAt ?? undefined),
        favorite: show.favorite ? true : undefined,
        notes: existing?.notes ? undefined : (show.notes ?? undefined),
        ownershipStatus: show.ownershipStatus,
        // A new ownership status drops the source and loan it no longer fits.
        ...(existing
          ? {
              ownershipSource: ownershipSourceUpdate(
                existing.ownershipStatus,
                show,
              ),
              ...loanUpdate(existing, {
                ownershipStatus: show.ownershipStatus,
              }),
            }
          : { ownershipSource: show.ownershipSource }),
      },
      create: {
        userId,
        mediaItemId,
        status: show.status,
        startedAt: show.startedAt,
        finishedAt: show.finishedAt,
        favorite: show.favorite,
        notes: show.notes ?? null,
        ownershipStatus: show.ownershipStatus ?? "NONE",
        ownershipSource: show.ownershipSource ?? null,
        createdAt: show.addedAt ?? undefined,
      },
    });
  }

  /** A film's rewatches, once: a re-run of the same import adds none. */
  async addMovieReplays(mediaEntryId: string, dates: Date[]): Promise<void> {
    const existing = await this.prisma.movieReplay.count({
      where: { mediaEntryId },
    });
    if (existing > 0) return; // Idempotent re-run.

    await this.prisma.movieReplay.createMany({
      data: dates.map((finishedAt) => ({ mediaEntryId, finishedAt })),
    });
  }

  /**
   * One row per watch of an episode, once: an episode the user already has
   * watches of is left alone. Returns how many were written.
   */
  async addEpisodeWatches(
    userId: string,
    episodeId: string,
    count: number,
    watchedAt: Date | null,
  ): Promise<number> {
    const existing = await this.prisma.episodeWatch.count({
      where: { userId, episodeId },
    });
    if (existing > 0) return 0; // Idempotent re-run.

    await this.prisma.episodeWatch.createMany({
      data: Array.from({ length: count }, () => ({
        userId,
        episodeId,
        watchedAt,
      })),
    });
    return count;
  }
}
