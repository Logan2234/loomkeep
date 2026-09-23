import { CatalogSource, MediaType } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { mapWithConcurrency } from "../../../common/concurrency.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type { ImportShow, ParsedImport } from "../../media-import-model";
import {
  MediaImportSource,
  type ResolvedMatch,
} from "../media/media-import.source";
import { MediaMatchResolver } from "../media/media-match-resolver";
import { type ImdbRatedEpisode, parseImdbCsv } from "./parse-imdb-csv";

/** Episode lookups in flight at once — same budget as the plan's resolution. */
const EPISODE_LOOKUP_CONCURRENCY = 5;

/** The parse model plus the episodes still to be located against TMDB. */
interface ImdbParsed extends ParsedImport {
  ratedEpisodes: ImdbRatedEpisode[];
}

/**
 * An IMDb CSV export (ratings or watchlist), reconciled through IMDb ids —
 * the one media source that matches exactly rather than by title and year.
 *
 * Episodes are the reason this source overrides {@link load}: IMDb lets a user
 * rate a single episode and exports only that episode's `tt` id, so the series
 * it belongs to and its numbering can only come from a TMDB lookup, which
 * `parseInput` (synchronous) cannot do.
 */
@Injectable()
export class ImdbImportSource extends MediaImportSource<ImdbParsed> {
  readonly id = "imdb";

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    matchResolver: MediaMatchResolver,
    reviews: ReviewService,
    private readonly tmdb: TmdbProvider,
  ) {
    super(prisma, mediaItemService, matchResolver, reviews);
  }

  parseInput(input: string): ImdbParsed {
    const { shows, movies, ratedEpisodes } = parseImdbCsv(input);
    return { source: this.id, shows, movies, ratedEpisodes };
  }

  /**
   * Turns each rated episode into a watch on its series, folding several
   * episodes of the same show into one entry so the plan shows one row per
   * series rather than one per episode.
   */
  protected override async load(parsed: ImdbParsed): Promise<void> {
    if (parsed.ratedEpisodes.length === 0) return;

    const located = await mapWithConcurrency(
      parsed.ratedEpisodes,
      EPISODE_LOOKUP_CONCURRENCY,
      async (rated) => {
        try {
          const found = await this.tmdb.findEpisodeByImdbId(rated.imdbId);
          return found ? { ...found, rating: rated.rating } : null;
        } catch {
          // An episode TMDB cannot place is dropped rather than failing the
          // whole import over one row.
          return null;
        }
      },
    );

    const showsByTmdbId = new Map<string, ImportShow>();

    for (const show of parsed.shows) {
      if (show.externalIds.tmdb) showsByTmdbId.set(show.externalIds.tmdb, show);
    }

    for (const episode of located) {
      if (!episode) continue;

      let show = showsByTmdbId.get(episode.seriesTmdbId);

      if (!show) {
        show = {
          // Replaced by the catalogue title once matched; the export never
          // names the series of a rated episode.
          title: `TMDB ${episode.seriesTmdbId}`,
          externalIds: { tmdb: episode.seriesTmdbId },
          episodes: [],
        };
        showsByTmdbId.set(episode.seriesTmdbId, show);
        parsed.shows.push(show);
      }

      show.episodes.push({
        season: episode.season,
        episode: episode.episode,
        sourceEpisodeId: `tmdb:${episode.seriesTmdbId}:${episode.season}:${episode.episode}`,
        // IMDb dates the rating, not the viewing (see the parser).
        watchedAt: null,
        totalWatches: 1,
        rating: episode.rating,
      });
    }
  }

  protected override acceptsMatch(match: ResolvedMatch): boolean {
    return (
      match.source === CatalogSource.TMDB &&
      (match.type === MediaType.MOVIE || match.type === MediaType.SERIES)
    );
  }
}
