import { type MediaDetailDto } from "@loomkeep/shared/contracts";
import {
  type CatalogSource,
  MediaType,
  ReviewTargetType,
} from "@loomkeep/shared/enums";
import { movieReleaseDates, movieReleaseInfo } from "@loomkeep/shared/rules";

import { Injectable } from "@nestjs/common";
import type {
  ExternalSource as DbExternalSource,
  MediaItem,
} from "@prisma/client";
import { utcDateKey } from "../common/date.util";
import { MediaItemService } from "./media-item.service";

import { PrismaService } from "../prisma/prisma.service";
import { ReviewService } from "../reviews/review.service";
import { AgeGateService } from "../users/age-gate.service";
import { normalizeAiringFinished } from "./status.util";

import {
  ENTRY_INCLUDE,
  NO_COMMUNITY_RATING,
  seenInViewing,
} from "./media-entries.util";
import { MediaProgressService } from "./media-progress.service";

/** The media page (`/app/media/{type}/{id}`): metadata and the viewer's entry. */
@Injectable()
export class MediaDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
    private readonly reviews: ReviewService,
    private readonly progress: MediaProgressService,
  ) {}

  /**
   * Unified media page (`/app/media/{type}/{id}`): metadata + the current user's
   * library state in one call. Served from the cache when the media is already
   * persisted, otherwise fetched live (persisting nothing — an unreferenced
   * media must not enter the on-demand cache just because it was previewed).
   */
  // `lang`: the signed-in user's locale, when known (live path only — a
  // cached item already has its stored, possibly stale, language).
  async getMediaDetail(
    userId: string,
    type: MediaType,
    sourceId: string,
    lang?: string,
    acceptLanguage?: string,
  ): Promise<MediaDetailDto> {
    const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";

    const ref = await this.prisma.mediaExternalId.findUnique({
      where: {
        source_externalId_type: {
          source: source as DbExternalSource,
          externalId: sourceId,
          type,
        },
      },
      include: { mediaItem: true },
    });

    if (ref) {
      if (type === "MOVIE" && ref.mediaItem.movieReleaseDates === null) {
        ref.mediaItem = await this.mediaItemService.upsertFromSource(
          source,
          sourceId,
          type,
        );
      }

      const detail = await this.mediaDetailFromCache(
        userId,
        source,
        sourceId,
        ref.mediaItem,
        type,
        lang,
        acceptLanguage,
      );
      const allowAdult = await this.ageGate.allowsAdultContent(userId);
      this.ageGate.assertAdultAllowed(detail.isAdult, allowAdult);
      return detail;
    }

    const details = await this.mediaItemService.getLiveDetails(
      source,
      sourceId,
      type,
      lang,
    );
    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    this.ageGate.assertAdultAllowed(details.isAdult, allowAdult);
    const region =
      type === "MOVIE"
        ? await this.progress.movieRegion(userId, acceptLanguage)
        : "US";
    return {
      source,
      sourceId,
      type,
      title: details.title,
      originalTitle: details.originalTitle ?? null,
      year: details.year,
      posterUrl: details.posterUrl,
      backdropUrl: details.backdropUrl,
      overview: details.overview,
      genres: details.genres,
      airingStatus: details.status,
      releaseDate: details.releaseDate ?? null,
      movieRelease:
        type === "MOVIE"
          ? movieReleaseInfo(
              details.movieReleaseDates ?? [],
              details.status,
              region,
            )
          : null,
      airingFinished: normalizeAiringFinished(details.status),
      runtimeMin: details.runtimeMin,
      isAdult: details.isAdult,
      // Nothing persisted yet, so no reviews either.
      seasons: details.seasons.map((season) => ({
        ...season,
        ...NO_COMMUNITY_RATING,
        episodes: season.episodes.map((episode) => ({
          ...episode,
          ...NO_COMMUNITY_RATING,
          commentCount: 0,
          watchCount: 0,
          seen: false,
          watches: [],
        })),
      })),
      commentTargetId: null,
      entry: null,
    };
  }

  private async mediaDetailFromCache(
    userId: string,
    source: CatalogSource,
    sourceId: string,
    media: MediaItem,
    type: MediaType,
    lang: string | undefined,
    acceptLanguage?: string,
  ): Promise<MediaDetailDto> {
    // Only fetched/created when `lang` isn't the base row's own (English)
    // language — see the note on MediaItemService.translationFor.
    const translation = lang
      ? await this.mediaItemService.translationFor(
          media.id,
          source,
          sourceId,
          type,
          lang,
        )
      : null;

    // Season/episode translations exist only for the locales translationFor
    // has cached (never the base row's own English).
    const locale = translation && lang ? lang : "";
    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: media.id },
      orderBy: { number: "asc" },
      include: {
        translations: { where: { locale } },
        episodes: {
          orderBy: { number: "asc" },
          include: {
            translations: { where: { locale } },
            watches: {
              where: { userId },
              orderBy: { watchedAt: { sort: "desc", nulls: "last" } },
              select: { id: true, watchedAt: true },
            },
          },
        },
      },
    });
    const [seasonRatings, episodeRatings, episodeComments] = await Promise.all([
      this.reviews.communityRatings(
        userId,
        ReviewTargetType.SEASON,
        seasons.map((s) => s.id),
      ),
      this.reviews.communityRatings(
        userId,
        ReviewTargetType.EPISODE,
        seasons.flatMap((s) => s.episodes.map((e) => e.id)),
      ),
      this.prisma.comment.groupBy({
        by: ["targetId"],
        where: {
          targetType: "EPISODE",
          targetId: {
            in: seasons.flatMap((s) => s.episodes.map((e) => e.id)),
          },
          deletedAt: null,
        },
        _count: { _all: true },
      }),
    ]);
    const commentCounts = new Map(
      episodeComments.map((row) => [row.targetId, row._count._all]),
    );

    const entryRow = await this.prisma.mediaEntry.findUnique({
      where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
      include: ENTRY_INCLUDE,
    });
    const entry = entryRow
      ? this.progress.toEntryDto(
          entryRow,
          await this.progress.computeProgress(
            userId,
            media.id,
            entryRow.rewatchStartedAt,
          ),
          await this.progress.lastWatchedAt(userId, media.id),
          await this.reviews.getRating(
            userId,
            ReviewTargetType.MEDIA,
            media.id,
          ),
        )
      : null;

    return {
      source,
      sourceId,
      type: media.type,
      title: translation?.title ?? media.title,
      // Original title is not persisted separately; only used for matching.
      originalTitle: null,
      year: media.releaseDate ? media.releaseDate.getUTCFullYear() : null,
      posterUrl: media.posterUrl,
      backdropUrl: media.backdropUrl,
      overview: translation?.overview ?? media.overview,
      genres: translation?.genres ?? media.genres,
      airingStatus: media.status,
      releaseDate: media.releaseDate ? utcDateKey(media.releaseDate) : null,
      movieRelease:
        type === "MOVIE"
          ? movieReleaseInfo(
              movieReleaseDates(media.movieReleaseDates),
              media.status,
              await this.progress.movieRegion(userId, acceptLanguage),
            )
          : null,
      airingFinished: normalizeAiringFinished(media.status),
      runtimeMin: media.runtimeMin,
      isAdult: media.isAdult,
      seasons: seasons.map((season) => ({
        id: season.id,
        number: season.number,
        title: season.translations[0]?.title ?? season.title,
        overview: season.translations[0]?.overview ?? season.overview,
        posterUrl: season.posterUrl,
        airDate: season.airDate?.toISOString() ?? null,
        voteAverage: season.voteAverage,
        ...(seasonRatings.get(season.id) ?? NO_COMMUNITY_RATING),
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          number: episode.number,
          title: episode.translations[0]?.title ?? episode.title,
          airDate: episode.airDate?.toISOString() ?? null,
          runtimeMin: episode.runtimeMin,
          overview: episode.translations[0]?.overview ?? episode.overview,
          stillUrl: episode.stillUrl,
          voteAverage: episode.voteAverage,
          voteCount: episode.voteCount,
          streamingUrl: episode.streamingUrl,
          streamingSite: episode.streamingSite,
          ...(episodeRatings.get(episode.id) ?? NO_COMMUNITY_RATING),
          commentCount: commentCounts.get(episode.id) ?? 0,
          watchCount: episode.watches.length,
          seen: episode.watches.some((w) =>
            seenInViewing(w.watchedAt, entryRow?.rewatchStartedAt ?? null),
          ),
          watches: episode.watches.map((w) => ({
            id: w.id,
            episodeId: episode.id,
            watchedAt: w.watchedAt?.toISOString() ?? null,
          })),
        })),
      })),
      commentTargetId: media.id,
      entry,
    };
  }
}
