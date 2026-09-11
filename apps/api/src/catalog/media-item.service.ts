import type {
  CatalogSource,
  MediaDetailsDto,
  MediaType,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { MediaItem } from "@prisma/client";
import { mapWithConcurrency } from "../common/concurrency.util";
import { isUniqueViolation } from "../common/prisma-error.util";
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

// Upper bound on how many stale media items one cron execution refreshes.
// The cron runs every 6h; at this cap and the concurrency below, a full
// batch (even at the ~1req/s TMDB/AniList throttle floor) finishes well
// within that window with headroom to spare, instead of an unbounded run
// growing without limit as the tracked catalog grows.
const MAX_REFRESHED_PER_RUN = 500;

// Low concurrency on purpose: AniList already serializes every call behind
// its own shared per-instance throttle (RequestThrottle, 700ms min interval —
// see anilist.provider.ts), so raising this only queues more requests behind
// that same throttle without finishing the batch any faster. It just lets a
// few independent media items overlap their network latency instead of
// refreshing one at a time.
const REFRESH_CONCURRENCY = 3;

// The language the base MediaItem row's own title/overview/genres are always
// fetched in (providers default to English when no `lang` is passed). Only
// non-default locales ever get a MediaItemTranslation row — a translation
// for the default locale would just duplicate the base row.
const DEFAULT_LOCALE = "en";

export interface MediaTranslation {
  title: string;
  overview: string | null;
  genres: string[];
}

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
      // Most stale first, so a catalog bigger than MAX_REFRESHED_PER_RUN
      // never starves the items that have been waiting the longest.
      orderBy: { lastSyncedAt: "asc" },
      take: MAX_REFRESHED_PER_RUN,
      include: { externalIds: true },
    });

    const outcomes = await mapWithConcurrency(
      items,
      REFRESH_CONCURRENCY,
      async (item): Promise<boolean> => {
        const sourceId = item.externalIds.find(
          (ext) => ext.source === item.canonicalSource,
        )?.externalId;
        if (!sourceId) return false;

        try {
          await this.upsertFromSource(
            item.canonicalSource as CatalogSource,
            sourceId,
            item.type as MediaType,
          );
          return true;
        } catch (err) {
          this.logger.error(`Refresh failed for media ${item.id}`, err);
          return false;
        }
      },
    );

    const refreshed = outcomes.filter(Boolean).length;

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

    const source = item.canonicalSource as CatalogSource;
    // No `lang` here either — see the note in upsertFromSource().
    const details = await this.providerFor(source).getDetails(
      sourceId,
      item.type as MediaType,
    );
    return this.refresh(
      source,
      sourceId,
      mediaItemId,
      item.type as MediaType,
      details,
    );
  }

  providerFor(source: CatalogSource): CatalogProvider {
    return source === "TMDB" ? this.tmdbProvider : this.anilistProvider;
  }

  /**
   * The title/overview/genres for `mediaItemId` in `locale`, when it's not
   * the default (English) locale already carried by the base row. Fetches
   * live and persists a new MediaItemTranslation row the first time this
   * locale is requested for this item; every later call (including the next
   * scheduled refresh — see `refresh()`) reuses/updates that same row.
   */
  async translationFor(
    mediaItemId: string,
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
    locale: string,
  ): Promise<MediaTranslation | null> {
    // AniList has no localization support: a "French" fetch would return the
    // exact same content as the English base row, so there's nothing to
    // cache a translation for.
    if (locale === DEFAULT_LOCALE || source === "ANILIST") return null;

    const existing = await this.prisma.mediaItemTranslation.findUnique({
      where: { mediaItemId_locale: { mediaItemId, locale } },
    });
    if (existing) return existing;

    const details = await this.providerFor(source).getDetails(
      sourceId,
      type,
      locale,
    );
    return this.prisma.mediaItemTranslation.upsert({
      where: { mediaItemId_locale: { mediaItemId, locale } },
      update: this.translationFields(details),
      create: { mediaItemId, locale, ...this.translationFields(details) },
    });
  }

  /**
   * Titles already cached in `locale` for the given media items, keyed by
   * mediaItemId — a batched read for list views. Deliberately does NOT fetch
   * live for items with no translation yet: a list can hold dozens of items,
   * and lazily populating one requires a live provider call (see
   * `translationFor`), which only happens from the detail page. A title
   * missing here just means the caller falls back to the base (English)
   * title until someone views that item's detail page in this locale.
   */
  async translatedTitles(
    mediaItemIds: string[],
    locale: string,
  ): Promise<Map<string, string>> {
    if (locale === DEFAULT_LOCALE || mediaItemIds.length === 0)
      return new Map();

    const rows = await this.prisma.mediaItemTranslation.findMany({
      where: { mediaItemId: { in: mediaItemIds }, locale },
      select: { mediaItemId: true, title: true },
    });
    return new Map(rows.map((r) => [r.mediaItemId, r.title]));
  }

  /**
   * Live details straight from the provider — nothing is persisted.
   * `lang`: the signed-in user's locale, when known.
   */
  async getLiveDetails(
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
    lang?: string,
  ): Promise<MediaDetailsDto> {
    const details = await this.providerFor(source).getDetails(
      sourceId,
      type,
      lang,
    );
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

    // Deliberately no `lang` here: the base MediaItem row must always be
    // DEFAULT_LOCALE ("en"), never a translation — translationFor()/
    // getMediaDetail() only skip the MediaItemTranslation lookup for that
    // locale because this call site guarantees it's what's actually stored.
    // Passing `lang` through here would silently break that guarantee.
    const details = await this.providerFor(source).getDetails(sourceId, type);

    if (existingRef) {
      return this.refresh(
        source,
        sourceId,
        existingRef.mediaItemId,
        type,
        details,
      );
    }

    try {
      return await this.createFresh(source, type, details);
    } catch (err) {
      // Two requests can reach here for the same uncached media — a double
      // click, two tabs, or an import resolving titles in parallel — since the
      // lookup above and this insert are seconds apart across a provider call.
      // The loser of that race violates MediaExternalId's unique constraint;
      // the winner's row is exactly what it was about to create, so adopt it
      // instead of failing the user's request with a 500.
      if (!isUniqueViolation(err)) throw err;

      const winner = await this.prisma.mediaExternalId.findUnique({
        where: {
          source_externalId_type: { source, externalId: sourceId, type },
        },
        include: { mediaItem: true },
      });
      if (winner) return winner.mediaItem;
      throw err;
    }
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
    source: CatalogSource,
    sourceId: string,
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

    // Refresh whatever locale translations already exist, on this same
    // cycle — see the note on MediaItemTranslation in the Prisma schema.
    const translations = await this.prisma.mediaItemTranslation.findMany({
      where: { mediaItemId },
      select: { locale: true },
    });

    for (const { locale } of translations) {
      try {
        const localized = await this.providerFor(source).getDetails(
          sourceId,
          type,
          locale,
        );
        await this.prisma.mediaItemTranslation.update({
          where: { mediaItemId_locale: { mediaItemId, locale } },
          data: this.translationFields(localized),
        });
      } catch (err) {
        this.logger.error(
          `Translation refresh failed for media ${mediaItemId} (${locale})`,
          err,
        );
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

  private translationFields(details: ProviderMediaDetails): MediaTranslation {
    return {
      title: details.summary.title,
      overview: details.overview,
      genres: details.genres,
    };
  }
}
