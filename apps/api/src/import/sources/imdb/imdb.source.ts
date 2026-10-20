import { ErrorCode, type ImportMatch } from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { AppException } from "../../../common/app.exception";
import { mapWithConcurrency } from "../../../common/concurrency.util";
import { ListService } from "../../../lists/list.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type { ProgressReporter } from "../../import-source";
import type {
  ImportMovie,
  ImportShow,
  ParsedImport,
} from "../../media-import-model";
import { MediaImportSource } from "../media/media-import.source";
import { MediaMatchResolver, toMatch } from "../media/media-match-resolver";
import {
  type ImdbFile,
  type ImdbRatedEpisode,
  parseImdbExport,
} from "./imdb.parser";

/** TMDB lookups in flight at once — same budget as the plan's resolution. */
const LOOKUP_CONCURRENCY = 5;

/** The parse model plus the episodes still to be located against TMDB. */
interface ImdbParsed extends ParsedImport {
  ratedEpisodes: ImdbRatedEpisode[];
}

type Found = Awaited<ReturnType<TmdbProvider["findByImdbId"]>>;

const NOTHING: Found = { movie: null, series: null, episode: null };

/**
 * IMDb's CSV exports (ratings, watchlist, lists), reconciled through IMDb ids
 * — the one media source that matches exactly rather than by title and year.
 *
 * Every id is looked up once, in {@link load}, rather than through the
 * shared resolver: TMDB's answer says what the title really is (a "TV
 * Special" can be an episode there), and an id TMDB does not know must stay
 * unmatched rather than fall back to a title search that could pick another
 * film. Episodes need it anyway: IMDb rates them one by one and exports only
 * the episode's own id, so its series and numbering come from the lookup.
 */
@Injectable()
export class ImdbImportSource extends MediaImportSource<ImdbParsed> {
  readonly id = "imdb";
  private readonly log = new Logger(ImdbImportSource.name);

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    matchResolver: MediaMatchResolver,
    reviews: ReviewService,
    lists: ListService,
    private readonly tmdb: TmdbProvider,
  ) {
    super(prisma, mediaItemService, matchResolver, reviews, lists);
  }

  /**
   * The web sends every dropped CSV at once as a JSON array of
   * `{ name, text }`; a bare CSV (one file, no name) is still read.
   */
  parseInput(input: string): ImdbParsed {
    const { shows, movies, ratedEpisodes, lists } = parseImdbExport(
      readFiles(input),
    );
    return { source: this.id, shows, movies, ratedEpisodes, lists };
  }

  protected override async load(
    parsed: ImdbParsed,
    progress: ProgressReporter,
  ): Promise<void> {
    const ids = [
      ...new Set([
        ...parsed.movies.map((movie) => movie.externalIds.imdb),
        ...parsed.shows.map((show) => show.externalIds.imdb),
        ...(parsed.lists ?? []).flatMap((list) =>
          list.items.map((item) => item.externalIds.imdb),
        ),
        ...parsed.ratedEpisodes.map((episode) => episode.imdbId),
      ]),
    ].filter((id): id is string => Boolean(id));
    progress.setTotal(ids.length);

    const found = new Map<string, Found>();
    await mapWithConcurrency(ids, LOOKUP_CONCURRENCY, async (id) => {
      try {
        found.set(id, await this.tmdb.findByImdbId(id));
      } catch (error) {
        // One failed lookup leaves that title for a manual match rather than
        // failing the whole analysis.
        this.log.warn(`IMDb lookup failed for ${id}: ${String(error)}`);
      }

      progress.tick();
    });
    const lookup = (id: string | undefined) => (id && found.get(id)) || NOTHING;

    this.settleTitles(parsed, lookup);
    const newSeries = this.attachEpisodes(parsed, lookup);

    // A series known only through its rated episodes still needs its title.
    progress.setTotal(ids.length + newSeries.size);
    await mapWithConcurrency(
      [...newSeries],
      LOOKUP_CONCURRENCY,
      async ([tmdbId, show]) => {
        show.match = await this.seriesMatch(tmdbId);
        if (show.match) show.title = show.match.title;
        progress.tick();
      },
    );

    for (const list of parsed.lists ?? []) {
      for (const item of list.items) {
        const hit = lookup(item.externalIds.imdb);
        const summary =
          item.type === "SERIES"
            ? (hit.series ?? hit.movie)
            : (hit.movie ?? hit.series);
        item.match = summary ? toMatch(summary) : null;
        if (summary) item.type = summary.type === "MOVIE" ? "MOVIE" : "SERIES";
      }
    }
  }

  /**
   * Gives every film and series its match, moving a row to the other side
   * when TMDB files it there (a TV movie IMDb types as a series, say).
   */
  private settleTitles(
    parsed: ImdbParsed,
    lookup: (id: string | undefined) => Found,
  ): void {
    const movies: ImportMovie[] = [];
    const shows: ImportShow[] = [];

    for (const movie of parsed.movies) {
      const hit = lookup(movie.externalIds.imdb);

      if (!hit.movie && hit.series) {
        shows.push({ ...asShow(movie), match: toMatch(hit.series) });
      } else {
        movies.push({ ...movie, match: hit.movie ? toMatch(hit.movie) : null });
      }
    }

    for (const show of parsed.shows) {
      const hit = lookup(show.externalIds.imdb);

      if (!hit.series && hit.movie) {
        movies.push({ ...asMovie(show), match: toMatch(hit.movie) });
      } else {
        shows.push({ ...show, match: hit.series ? toMatch(hit.series) : null });
      }
    }

    parsed.movies = movies;
    parsed.shows = shows;
  }

  /**
   * Turns each rated episode into a watch on its series, folded into the
   * series' row when the export has one, so the plan shows one row per series
   * rather than one per episode. Returns the series the export only knows
   * through their episodes, by TMDB id.
   */
  private attachEpisodes(
    parsed: ImdbParsed,
    lookup: (id: string | undefined) => Found,
  ): Map<string, ImportShow> {
    const showsBySeries = new Map<string, ImportShow>();

    for (const show of parsed.shows) {
      if (show.match) showsBySeries.set(show.match.sourceId, show);
    }

    let unplaced = 0;
    const newSeries = new Map<string, ImportShow>();

    for (const rated of parsed.ratedEpisodes) {
      const episode = lookup(rated.imdbId).episode;

      if (!episode) {
        unplaced++;
        continue;
      }

      let show = showsBySeries.get(episode.seriesTmdbId);

      if (!show) {
        show = {
          // Replaced by the catalogue title once looked up: the export never
          // names the series of a rated episode.
          title: `TMDB ${episode.seriesTmdbId}`,
          externalIds: { tmdb: episode.seriesTmdbId },
          episodes: [],
          match: null,
        };
        showsBySeries.set(episode.seriesTmdbId, show);
        newSeries.set(episode.seriesTmdbId, show);
        parsed.shows.push(show);
      }

      show.episodes.push({
        season: episode.season,
        episode: episode.episode,
        sourceEpisodeId: `tmdb:${episode.seriesTmdbId}:${episode.season}:${episode.episode}`,
        // IMDb dates the rating, not the viewing (see the parser).
        watchedAt: null,
        totalWatches: 1,
        rating: rated.rating,
      });
    }

    parsed.unplaced = unplaced;
    return newSeries;
  }

  private async seriesMatch(tmdbId: string): Promise<ImportMatch | null> {
    try {
      return toMatch(await this.tmdb.getSeriesSummaryByTmdbId(tmdbId));
    } catch {
      return null;
    }
  }
}

/** The uploaded files, from the web's JSON array or a bare CSV. */
function readFiles(input: string): ImdbFile[] {
  if (!input.trimStart().startsWith("[")) return [{ name: null, text: input }];

  let files: unknown;

  try {
    files = JSON.parse(input);
  } catch {
    files = null;
  }

  if (
    !Array.isArray(files) ||
    files.some(
      (file) =>
        typeof file?.name !== "string" || typeof file?.text !== "string",
    )
  ) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ImportMalformedExport,
    );
  }

  return files as ImdbFile[];
}

function asShow(movie: ImportMovie): ImportShow {
  return {
    title: movie.title,
    externalIds: movie.externalIds,
    episodes: [],
    rating: movie.rating,
    status: movie.watched ? "WATCHING" : "PLANNED",
    notes: movie.notes,
    addedAt: movie.addedAt,
  };
}

function asMovie(show: ImportShow): ImportMovie {
  return {
    title: show.title,
    year: null,
    watched: show.status !== "PLANNED",
    watchedAt: null,
    rewatchedAt: [],
    rating: show.rating,
    notes: show.notes,
    addedAt: show.addedAt,
    externalIds: show.externalIds,
  };
}
