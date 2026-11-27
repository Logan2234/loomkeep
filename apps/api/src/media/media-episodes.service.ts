import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  type EntryEpisodesResponseDto,
  EPISODE_WATCH_BATCH_MAX,
  EPISODE_WATCH_UNDO_MAX,
  type EpisodeWatchBatchAction,
  type EpisodeWatchBatchResultDto,
  type EpisodeWatchDto,
  type EpisodeWatchRestoreDto,
} from "@loomkeep/shared/contracts";
import {
  ActivityType,
  Domain,
  MediaType,
  ReviewTargetType,
  XpReason,
} from "@loomkeep/shared/enums";
import { seasonCompletedXp, seriesCompletedXp } from "../gamification/xp-rules";

import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { AchievementService } from "../gamification/achievements/achievement.service";

import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/triggers";
import {
  isSeasonComplete,
  isSeriesComplete,
} from "../gamification/xp-verifiers";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { WatchEpisodeDto } from "./dto/watch-episode.dto";

import {
  assertWatchDateNotFuture,
  inViewing,
  seenInViewing,
} from "./media-entries.util";
import { MediaProgressService } from "./media-progress.service";

/**
 * Episode watches of a series or anime: one, a season, up to an episode, in
 * batches and undone, with the season, series and saga XP they earn.
 */
@Injectable()
export class MediaEpisodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
    private readonly progress: MediaProgressService,
  ) {}

  /**
   * Every aired episode of every regular season watched (specials never count,
   * as for progress), in one pass: one read, one insert, one XP and progress
   * sync for the whole series. Going season by season through watchSeason()
   * repeated all of that per season, which made a bulk "completed" over a
   * selection of long series run past the proxy's timeout.
   */
  async watchAllAired(
    userId: string,
    mediaItemId: string,
    type: MediaType,
  ): Promise<boolean> {
    const episodes = await this.prisma.episode.findMany({
      where: { season: { mediaItemId, number: { gt: 0 } } },
      select: { id: true, airDate: true },
    });
    if (episodes.length === 0) return false;

    const episodeIds = episodes.map((episode) => episode.id);
    const previouslyWatchedIds = await this.progress.watchedEpisodeIds(userId, {
      episodeId: { in: episodeIds },
    });
    // Unreleased episodes (future airDate) are skipped, as watchSeason does.
    const now = new Date();
    const airedIds = episodes
      .filter((episode) => !episode.airDate || episode.airDate <= now)
      .map((episode) => episode.id);

    await this.markWatchedIfNew(
      userId,
      airedIds,
      await this.progress.rewatchStartedAt(userId, mediaItemId),
    );
    await this.progress.syncFinishedAt(userId, mediaItemId, type);
    await this.progress.endFinishedRewatches(userId, [mediaItemId]);
    await this.emitSeasonFinishedMilestones(
      userId,
      mediaItemId,
      episodeIds,
      previouslyWatchedIds,
    );
    return true;
  }

  /**
   * Emits the SEASON_FINISHED milestone for every season, among the ones
   * touched by `affectedEpisodeIds`, that has just become fully watched and
   * wasn't before this action — distinct from the work-level FINISHED
   * (`syncFinishedAt`), so a feed can tell "finished season 3" from
   * "finished the whole show". Season 0 (TMDB specials) is excluded,
   * matching `computeProgress`'s own exclusion.
   *
   * `previouslyWatchedIds` must cover every episode of every season
   * `affectedEpisodeIds` might touch (not just the acted-upon ones) — a
   * partial set would under-count an already-complete season as "newly"
   * finished.
   */
  private async emitSeasonFinishedMilestones(
    userId: string,
    mediaItemId: string,
    affectedEpisodeIds: string[],
    previouslyWatchedIds: Set<string>,
  ): Promise<void> {
    if (affectedEpisodeIds.length === 0) return;

    const rawSeasons = await this.prisma.season.findMany({
      where: {
        mediaItemId,
        number: { gt: 0 },
        episodes: { some: { id: { in: affectedEpisodeIds } } },
      },
      select: { number: true, episodes: { select: { id: true } } },
    });
    // `?? []` tolerates a caller-narrowed select that doesn't happen to
    // include `episodes` — never the case for this query's own shape above,
    // but keeps this from throwing on a shared-mock testing setup.
    const seasons = rawSeasons.map((s) => ({
      number: s.number,
      episodes: s.episodes ?? [],
    }));
    if (seasons.length === 0) return;

    const nowWatchedIds = await this.progress.watchedEpisodeIds(userId, {
      episodeId: { in: seasons.flatMap((s) => s.episodes.map((e) => e.id)) },
    });

    for (const season of seasons) {
      if (season.episodes.length === 0) continue;

      const wasComplete = season.episodes.every((e) =>
        previouslyWatchedIds.has(e.id),
      );
      if (wasComplete) continue; // already emitted on an earlier watch

      const isComplete = season.episodes.every((e) => nowWatchedIds.has(e.id));
      if (!isComplete) continue;

      await this.activity.emit({
        userId,
        type: ActivityType.SEASON_FINISHED,
        domain: Domain.MEDIA,
        targetType: ReviewTargetType.MEDIA,
        targetId: mediaItemId,
        level: "SEASON",
        data: { seasonNumber: season.number },
        homeFeed: true,
      });
    }
  }

  /** Persisted seasons/episodes of an entry's media, with the user's watch counts. */
  async getEntryEpisodes(
    userId: string,
    entryId: string,
  ): Promise<EntryEpisodesResponseDto> {
    const entry = await this.progress.assertEntryOwnership(userId, entryId);

    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: entry.mediaItemId },
      orderBy: { number: "asc" },
      include: {
        episodes: {
          orderBy: { number: "asc" },
          include: { watches: { where: { userId }, select: { id: true } } },
        },
      },
    });

    return {
      seasons: seasons.map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: episode.title,
          airDate: episode.airDate?.toISOString() ?? null,
          watchCount: episode.watches.length,
        })),
      })),
    };
  }

  async watchEpisode(
    userId: string,
    episodeId: string,
    dto: WatchEpisodeDto,
  ): Promise<EpisodeWatchDto> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        season: {
          select: { mediaItemId: true, mediaItem: { select: { type: true } } },
        },
      },
    });

    if (!episode) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEpisodeNotFound,
      );
    }

    await this.progress.assertMediaOwnership(
      userId,
      episode.season.mediaItemId,
    );

    if (episode.airDate && episode.airDate > new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryEpisodeNotAired,
      );
    }

    assertWatchDateNotFuture(dto.watchedAt);

    const previouslyWatchedIds = await this.progress.watchedEpisodeIds(userId, {
      episode: { seasonId: episode.seasonId },
    });

    const watch = await this.prisma.episodeWatch.create({
      data: {
        userId,
        episodeId,
        watchedAt: dto.watchedAt ? new Date(dto.watchedAt) : undefined,
      },
    });

    await this.xp.award(userId, XpReason.EPISODE_WATCHED, watch.id);
    await this.achievements.evaluate(
      userId,
      ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.EPISODE_WATCHED],
    );
    await this.syncSeasonAndSeriesXp(userId, [episode.seasonId]);

    await this.progress.syncFinishedAt(
      userId,
      episode.season.mediaItemId,
      episode.season.mediaItem.type,
    );

    await this.progress.endFinishedRewatches(userId, [
      episode.season.mediaItemId,
    ]);

    await this.emitSeasonFinishedMilestones(
      userId,
      episode.season.mediaItemId,
      [episodeId],
      previouslyWatchedIds,
    );

    await this.activity.emit({
      userId,
      type: ActivityType.PROGRESS,
      domain: "MEDIA",
      targetType: ReviewTargetType.MEDIA,
      targetId: episode.season.mediaItemId,
      level: "EPISODE",
      homeFeed: true,
    });

    return {
      id: watch.id,
      episodeId: watch.episodeId,
      watchedAt: watch.watchedAt?.toISOString() ?? null,
    };
  }

  /**
   * Mark every not-yet-watched episode of a season as watched in one go.
   * Already-watched episodes are skipped so this never inflates rewatch counts.
   */
  async watchSeason(userId: string, seasonId: string): Promise<void> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { mediaItemId: true, mediaItem: { select: { type: true } } },
    });
    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true, airDate: true },
    });

    if (!season || episodes.length === 0) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibrarySeasonEmpty,
      );
    }

    await this.progress.assertMediaOwnership(userId, season.mediaItemId);

    const previouslyWatchedIds = await this.progress.watchedEpisodeIds(userId, {
      episodeId: { in: episodes.map((e) => e.id) },
    });

    // Unreleased episodes (future airDate) are silently skipped rather than
    // blocking the whole season.
    const now = new Date();
    const airedIds = episodes
      .filter((e) => !e.airDate || e.airDate <= now)
      .map((e) => e.id);
    await this.markWatchedIfNew(
      userId,
      airedIds,
      await this.progress.rewatchStartedAt(userId, season.mediaItemId),
    );
    await this.progress.syncFinishedAt(
      userId,
      season.mediaItemId,
      season.mediaItem.type,
    );
    await this.progress.endFinishedRewatches(userId, [season.mediaItemId]);
    await this.emitSeasonFinishedMilestones(
      userId,
      season.mediaItemId,
      episodes.map((e) => e.id),
      previouslyWatchedIds,
    );
  }

  /**
   * Undo a whole season: removes every watch the user has recorded for its
   * episodes (all rewatches included, not just the latest one per episode) —
   * during a rewatch, only the ones since it began.
   */
  async unwatchSeason(userId: string, seasonId: string): Promise<void> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      select: { mediaItemId: true, mediaItem: { select: { type: true } } },
    });

    if (!season) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibrarySeasonNotFound,
        undefined,
        "Season not found",
      );
    }

    await this.progress.assertMediaOwnership(userId, season.mediaItemId);

    const episodes = await this.prisma.episode.findMany({
      where: { seasonId },
      select: { id: true },
    });

    // Loaded before the deleteMany so revokeBySource still has the ids to
    // work with afterwards. Never award/revoke inside a
    // transaction, and here there's nothing left to look up post-delete).
    const where: Prisma.EpisodeWatchWhereInput = {
      userId,
      episodeId: { in: episodes.map((e) => e.id) },
      ...inViewing(
        await this.progress.rewatchStartedAt(userId, season.mediaItemId),
      ),
    };
    const watches = await this.prisma.episodeWatch.findMany({
      where,
      select: { id: true },
    });

    await this.prisma.episodeWatch.deleteMany({ where });
    await this.xp.revokeBySource(
      userId,
      "EpisodeWatch",
      watches.map((w) => w.id),
    );
    await this.syncSeasonAndSeriesXp(userId, [seasonId]);
    await this.progress.syncFinishedAt(
      userId,
      season.mediaItemId,
      season.mediaItem.type,
    );
  }

  /**
   * "Watch up to here": mark every regular episode of the series from the start
   * up to and including the given one (specials excluded — they are not part of
   * the linear run). If the target itself is a special, only it is marked.
   */
  async watchThrough(userId: string, episodeId: string): Promise<void> {
    const target = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        season: { include: { mediaItem: { select: { type: true } } } },
      },
    });

    if (!target) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEpisodeNotFound,
      );
    }

    await this.progress.assertMediaOwnership(userId, target.season.mediaItemId);

    if (target.airDate && target.airDate > new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryEpisodeNotAired,
      );
    }

    const rewatchStartedAt = await this.progress.rewatchStartedAt(
      userId,
      target.season.mediaItemId,
    );

    if (target.season.number === 0) {
      await this.markWatchedIfNew(userId, [episodeId], rewatchStartedAt);
    } else {
      const episodes = await this.prisma.episode.findMany({
        where: {
          season: { mediaItemId: target.season.mediaItemId, number: { gt: 0 } },
        },
        select: {
          id: true,
          number: true,
          airDate: true,
          season: { select: { number: true } },
        },
      });
      const now = new Date();
      const throughIds = episodes
        .filter(
          (e) =>
            (e.season.number < target.season.number ||
              (e.season.number === target.season.number &&
                e.number <= target.number)) &&
            (!e.airDate || e.airDate <= now),
        )
        .map((e) => e.id);

      // Scoped to every regular episode of the series (not just `throughIds`)
      // so a season that was already fully watched before this call — but
      // only partially covered by `throughIds` (the target's own season) —
      // isn't under-counted as "newly" finished below.
      const previouslyWatchedIds = await this.progress.watchedEpisodeIds(
        userId,
        {
          episodeId: { in: episodes.map((e) => e.id) },
        },
      );

      await this.markWatchedIfNew(userId, throughIds, rewatchStartedAt);
      await this.emitSeasonFinishedMilestones(
        userId,
        target.season.mediaItemId,
        throughIds,
        previouslyWatchedIds,
      );
    }

    await this.progress.syncFinishedAt(
      userId,
      target.season.mediaItemId,
      target.season.mediaItem.type,
    );
    await this.progress.endFinishedRewatches(userId, [
      target.season.mediaItemId,
    ]);
  }

  private async markWatchedIfNew(
    userId: string,
    episodeIds: string[],
    rewatchStartedAt: Date | null = null,
  ): Promise<void> {
    if (episodeIds.length === 0) return;
    const watchedIds = await this.progress.watchedEpisodeIds(userId, {
      episodeId: { in: episodeIds },
      ...inViewing(rewatchStartedAt),
    });
    const newEpisodeIds = episodeIds.filter((id) => !watchedIds.has(id));
    const toCreate = newEpisodeIds.map((id) => ({ userId, episodeId: id }));

    if (toCreate.length > 0) {
      const created = await this.prisma.episodeWatch.createManyAndReturn({
        data: toCreate,
        select: { id: true },
      });
      await this.xp.awardMany(
        userId,
        XpReason.EPISODE_WATCHED,
        created.map((w) => w.id),
      );

      // Grouped by season, not per-episode, so a whole-season/whole-series
      // mark-through only checks completion once per season involved.
      const touchedSeasons = await this.prisma.episode.findMany({
        where: { id: { in: newEpisodeIds } },
        distinct: ["seasonId"],
        select: { seasonId: true },
      });
      await this.syncSeasonAndSeriesXp(
        userId,
        touchedSeasons.map((e) => e.seasonId),
      );
    }
  }

  /**
   * Re-derives SEASON_COMPLETED/SERIES_COMPLETED after a watch change
   * touching `seasonIds`, awarding or revoking each as needed. Reuses
   * `isSeasonComplete`/`isSeriesComplete` from xp-verifiers.ts — the same
   * completion rule the nightly reconciliation checks — so this live path
   * and that sweep can never disagree. Called once per batch of episodes
   * touched (never per individual episode), grouped by the distinct
   * seasons/series involved.
   */
  private async syncSeasonAndSeriesXp(
    userId: string,
    seasonIds: string[],
  ): Promise<void> {
    const uniqueSeasonIds = [...new Set(seasonIds)];
    if (uniqueSeasonIds.length === 0) return;

    const seasons = await this.prisma.season.findMany({
      where: { id: { in: uniqueSeasonIds } },
      select: { id: true, mediaItemId: true },
    });

    for (const season of seasons) {
      const complete = await isSeasonComplete(this.prisma, userId, season.id);

      if (complete) {
        const episodes = await this.prisma.episode.count({
          where: { seasonId: season.id },
        });
        await this.xp.award(
          userId,
          XpReason.SEASON_COMPLETED,
          season.id,
          seasonCompletedXp(episodes),
        );
      } else {
        await this.xp.revokeBySource(userId, "Season", [season.id]);
      }
    }

    const mediaItemIds = [...new Set(seasons.map((s) => s.mediaItemId))];
    const entries = await this.prisma.mediaEntry.findMany({
      where: { userId, mediaItemId: { in: mediaItemIds } },
      select: { id: true, mediaItemId: true },
    });

    for (const entry of entries) {
      const complete = await isSeriesComplete(this.prisma, userId, entry.id);

      if (complete) {
        const seasons = await this.prisma.season.count({
          where: { mediaItemId: entry.mediaItemId, number: { gt: 0 } },
        });
        await this.xp.award(
          userId,
          XpReason.SERIES_COMPLETED,
          entry.id,
          seriesCompletedXp(seasons),
        );
        await this.achievements.evaluate(
          userId,
          ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.SERIES_COMPLETED],
        );
        await this.progress.awardSagaIfCompleted(userId, entry.mediaItemId);
      } else {
        await this.xp.revokeBySource(userId, "MediaEntry", [entry.id]);
      }
    }
  }

  /**
   * Undo watching an episode: removes the user's most recent watch for it
   * (so it decrements a rewatch count, and unwatches the episode at one watch).
   */
  async unwatchEpisode(userId: string, episodeId: string): Promise<void> {
    const latest = await this.prisma.episodeWatch.findFirst({
      where: { userId, episodeId },
      orderBy: { watchedAt: { sort: "desc", nulls: "last" } },
      include: {
        episode: {
          include: {
            season: { include: { mediaItem: { select: { type: true } } } },
          },
        },
      },
    });

    if (!latest) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryNoWatchToUndo,
      );
    }

    await this.progress.assertMediaOwnership(
      userId,
      latest.episode.season.mediaItemId,
    );

    await this.prisma.episodeWatch.delete({ where: { id: latest.id } });
    await this.xp.revokeBySource(userId, "EpisodeWatch", [latest.id]);
    await this.syncSeasonAndSeriesXp(userId, [latest.episode.seasonId]);
    await this.progress.syncFinishedAt(
      userId,
      latest.episode.season.mediaItemId,
      latest.episode.season.mediaItem.type,
    );
  }

  /**
   * One action over episodes picked by hand, possibly across seasons: `watch`
   * skips what's already watched or not aired, `rewatch` what isn't watched,
   * `unwatch` removes every viewing. Effects are those of a whole-season mark
   * (one milestone per finished season, no per-episode activity), and the
   * result is what `undoEpisodeWatches` needs to put things back.
   */
  async batchEpisodeWatches(
    userId: string,
    action: EpisodeWatchBatchAction,
    episodeIds: string[],
  ): Promise<EpisodeWatchBatchResultDto> {
    const ids = [...new Set(episodeIds)];

    if (ids.length > EPISODE_WATCH_BATCH_MAX) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryWatchBatchTooLarge,
      );
    }

    const episodes = await this.ownedEpisodes(userId, ids);
    const rewatches = new Map(
      (
        await this.prisma.mediaEntry.findMany({
          where: {
            userId,
            mediaItemId: {
              in: [...new Set(episodes.map((e) => e.season.mediaItemId))],
            },
          },
          select: { mediaItemId: true, rewatchStartedAt: true },
        })
      ).map((e) => [e.mediaItemId, e.rewatchStartedAt]),
    );
    const mediaOf = new Map(episodes.map((e) => [e.id, e.season.mediaItemId]));
    // During a rewatch, watching, unwatching and what counts as watched only
    // concern the viewings since it began; rewatching still takes any.
    const allWatches = await this.prisma.episodeWatch.findMany({
      where: { userId, episodeId: { in: ids } },
      select: { id: true, episodeId: true, watchedAt: true },
    });
    const watches = allWatches.filter((watch) =>
      seenInViewing(
        watch.watchedAt,
        rewatches.get(mediaOf.get(watch.episodeId)!) ?? null,
      ),
    );
    const watchedIds = new Set(watches.map((watch) => watch.episodeId));
    const everWatchedIds = new Set(allWatches.map((watch) => watch.episodeId));

    if (action === "unwatch") {
      await this.prisma.episodeWatch.deleteMany({
        where: { id: { in: watches.map((watch) => watch.id) } },
      });
      await this.xp.revokeBySource(
        userId,
        "EpisodeWatch",
        watches.map((watch) => watch.id),
      );
      await this.syncAfterWatchChange(userId, episodes);
      return {
        created: [],
        removed: watches.map((watch) => ({
          episodeId: watch.episodeId,
          watchedAt: watch.watchedAt?.toISOString() ?? null,
        })),
      };
    }

    const now = new Date();
    const targets = episodes.filter((episode) =>
      action === "rewatch"
        ? everWatchedIds.has(episode.id)
        : !watchedIds.has(episode.id) &&
          (!episode.airDate || episode.airDate <= now),
    );
    const previouslyWatchedIds =
      action === "watch"
        ? await this.progress.watchedEpisodeIds(userId, {
            episode: {
              seasonId: { in: targets.map((episode) => episode.seasonId) },
            },
          })
        : new Set<string>();

    const created = await this.prisma.episodeWatch.createManyAndReturn({
      data: targets.map((episode) => ({ userId, episodeId: episode.id })),
      select: { id: true, episodeId: true },
    });
    await this.xp.awardMany(
      userId,
      XpReason.EPISODE_WATCHED,
      created.map((watch) => watch.id),
    );

    if (created.length > 0) {
      await this.achievements.evaluate(
        userId,
        ACHIEVEMENT_KEYS_BY_XP_REASON[XpReason.EPISODE_WATCHED],
      );
    }

    await this.syncAfterWatchChange(userId, targets);

    if (action === "watch") {
      for (const mediaItemId of new Set(
        targets.map((episode) => episode.season.mediaItemId),
      )) {
        await this.emitSeasonFinishedMilestones(
          userId,
          mediaItemId,
          targets
            .filter((episode) => episode.season.mediaItemId === mediaItemId)
            .map((episode) => episode.id),
          previouslyWatchedIds,
        );
      }
    }

    return { created, removed: [] };
  }

  /**
   * Takes a bulk action back: viewings it created go, viewings it removed come
   * back with their original dates. Nothing is announced, as the viewer is
   * only returning to where they stood.
   */
  async undoEpisodeWatches(
    userId: string,
    {
      deleteWatchIds = [],
      restore = [],
    }: {
      deleteWatchIds?: string[];
      restore?: EpisodeWatchRestoreDto[];
    },
  ): Promise<void> {
    if (deleteWatchIds.length + restore.length > EPISODE_WATCH_UNDO_MAX) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryWatchBatchTooLarge,
      );
    }

    const toDelete = await this.prisma.episodeWatch.findMany({
      where: { id: { in: deleteWatchIds } },
      select: { id: true, userId: true, episodeId: true },
    });

    if (toDelete.some((watch) => watch.userId !== userId)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibraryEntryForbidden,
      );
    }

    const episodes = await this.ownedEpisodes(userId, [
      ...new Set([
        ...toDelete.map((watch) => watch.episodeId),
        ...restore.map((row) => row.episodeId),
      ]),
    ]);

    // A restore only brings back what a bulk action removed, so it obeys
    // the same rules as the viewing it restores: aired, not dated ahead.
    const now = new Date();
    const restoredIds = new Set(restore.map((row) => row.episodeId));

    if (
      episodes.some(
        (episode) =>
          restoredIds.has(episode.id) &&
          episode.airDate &&
          episode.airDate > now,
      )
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LibraryEpisodeNotAired,
      );
    }

    restore.forEach((row) => assertWatchDateNotFuture(row.watchedAt, now));

    const [, created] = await this.prisma.$transaction([
      this.prisma.episodeWatch.deleteMany({
        where: { id: { in: toDelete.map((watch) => watch.id) } },
      }),
      this.prisma.episodeWatch.createManyAndReturn({
        data: restore.map((row) => ({
          userId,
          episodeId: row.episodeId,
          // Null stays null: a missing value would take the column's now().
          watchedAt: row.watchedAt ? new Date(row.watchedAt) : null,
        })),
        select: { id: true },
      }),
    ]);

    await this.xp.revokeBySource(
      userId,
      "EpisodeWatch",
      toDelete.map((watch) => watch.id),
    );
    await this.xp.awardMany(
      userId,
      XpReason.EPISODE_WATCHED,
      created.map((watch) => watch.id),
    );
    await this.syncAfterWatchChange(userId, episodes);
  }

  /** The episodes, once the caller is known to track every work they're from. */
  private async ownedEpisodes(userId: string, episodeIds: string[]) {
    const episodes = await this.prisma.episode.findMany({
      where: { id: { in: episodeIds } },
      select: {
        id: true,
        airDate: true,
        seasonId: true,
        season: {
          select: { mediaItemId: true, mediaItem: { select: { type: true } } },
        },
      },
    });

    if (episodes.length !== episodeIds.length) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryEpisodeNotFound,
      );
    }

    for (const mediaItemId of new Set(
      episodes.map((episode) => episode.season.mediaItemId),
    )) {
      await this.progress.assertMediaOwnership(userId, mediaItemId);
    }

    return episodes;
  }

  /** Never inside the write's transaction: XP is awarded and revoked here. */
  private async syncAfterWatchChange(
    userId: string,
    episodes: {
      seasonId: string;
      season: { mediaItemId: string; mediaItem: { type: MediaType } };
    }[],
  ): Promise<void> {
    await this.syncSeasonAndSeriesXp(
      userId,
      episodes.map((episode) => episode.seasonId),
    );
    const types = new Map(
      episodes.map((episode) => [
        episode.season.mediaItemId,
        episode.season.mediaItem.type,
      ]),
    );

    for (const [mediaItemId, type] of types) {
      await this.progress.syncFinishedAt(userId, mediaItemId, type);
    }

    await this.progress.endFinishedRewatches(userId, [...types.keys()]);
  }
}
