import type {
  CatalogSource,
  EntryStatus,
  ImportMatch,
  ImportPlan,
  ImportPlanGroup,
  ImportPlanItem,
  ImportReport,
  ImportSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import { Domain, entryStatusFromProgress } from "@loomkeep/shared";
import { Logger } from "@nestjs/common";
import type { ExternalSource as DbExternalSource } from "@prisma/client";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CommitDecisions,
  ImportReq,
  ProgressReporter,
} from "../../import-source";
import type {
  ImportMovie,
  ImportShow,
  ParsedImport,
} from "../../media-import-model";

/** A catalogue match resolved to its required media type, ready to write. */
type ResolvedMatch = {
  source: CatalogSource;
  sourceId: string;
  type: MediaType;
};

/** Season/episode listing reduced to what episode matching needs. */
interface EpisodeIndex {
  /** "season|episode" → persisted episode id. */
  byKey: Map<string, string>;
  /** Total episodes outside season 0 — the denominator for completion. */
  totalRegular: number;
}

/** Running tallies a commit turns into the report tiles. */
interface CommitTally {
  showsImported: number;
  showsWatchlist: number;
  episodesCreated: number;
  moviesImported: number;
  moviesWatchlist: number;
}

/**
 * Shared mechanics of a **media** import (TV Time, Trakt, and future sources)
 * as an {@link ImportReq}: resolve every show/movie against TMDB (writing
 * nothing) → persist the chosen titles + episode watches on commit. A
 * concrete source only supplies {@link ImportReq.id} and how its raw export
 * becomes {@link ParsedImport.shows}/`.movies` — the resolve/plan/commit flow
 * lives here so a new source never re-implements it.
 *
 * Generic over `TParsed`, the source's own parse model (always at least
 * {@link ParsedImport}) — kept on the job between analyze and a later commit.
 */
export abstract class MediaImportSource<
  TParsed extends ParsedImport,
> implements ImportReq<TParsed> {
  private readonly logger = new Logger(this.constructor.name);
  abstract readonly id: ImportSource;
  readonly searchDomain = Domain.MEDIA;
  readonly supportsOverwrite = true;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly mediaItemService: MediaItemService,
    protected readonly tmdb: TmdbProvider,
  ) {}

  abstract parseInput(input: string, options: Record<string, boolean>): TParsed;

  /**
   * Hook for sources whose export can only be fetched over the network
   * (Trakt's own API) rather than parsed synchronously in {@link parseInput}:
   * mutate `parsed.shows`/`parsed.movies` in place. No-op by default — a
   * source that already parses everything in `parseInput` (TV Time's CSVs)
   * never needs to override it.
   */
  protected async load(parsed: TParsed): Promise<void> {
    void parsed; // Unused here — TV Time already parses synchronously in parseInput.
  }

  async buildPlan(
    _userId: string,
    parsed: TParsed,
    progress: ProgressReporter,
  ): Promise<ImportPlan> {
    await this.load(parsed);
    progress.setTotal(parsed.shows.length + parsed.movies.length);

    const seriesTracked: ImportPlanItem[] = [];
    const seriesWatchlist: ImportPlanItem[] = [];
    const moviesWatched: ImportPlanItem[] = [];
    const moviesWatchlist: ImportPlanItem[] = [];
    let unresolved = 0;

    for (const show of parsed.shows) {
      const match = await this.resolveShowMatch(show);
      if (!match) unresolved++;
      const n = show.episodes.length;
      const item: ImportPlanItem = {
        key: showKey(show),
        title: match?.title ?? show.title,
        sourceTitle: show.title,
        subtitle:
          n > 0
            ? `${n} épisode${n > 1 ? "s" : ""} vu${n > 1 ? "s" : ""}`
            : "Watchlist",
        coverUrl: match?.coverUrl ?? null,
        match,
        include: match !== null,
        alreadyInLibrary: false,
        defaultStatus: null,
      };
      (n === 0 ? seriesWatchlist : seriesTracked).push(item);
      progress.tick();
    }

    for (const movie of parsed.movies) {
      const match = await this.resolveMovieMatch(movie);
      if (!match) unresolved++;
      const item: ImportPlanItem = {
        key: movieKey(movie),
        title: match?.title ?? movie.title,
        sourceTitle: movie.title,
        subtitle: movie.year ? String(movie.year) : null,
        coverUrl: match?.coverUrl ?? null,
        match,
        include: match !== null,
        alreadyInLibrary: false,
        defaultStatus: null,
      };
      (movie.watched ? moviesWatched : moviesWatchlist).push(item);
      progress.tick();
    }

    const groups: ImportPlanGroup[] = [
      { id: "seriesTracked", label: "Séries suivies", items: seriesTracked },
      {
        id: "seriesWatchlist",
        label: "Séries — watchlist",
        items: seriesWatchlist,
      },
      { id: "moviesWatched", label: "Films vus", items: moviesWatched },
      {
        id: "moviesWatchlist",
        label: "Films — watchlist",
        items: moviesWatchlist,
      },
    ].filter((g) => g.items.length > 0);

    const total = parsed.shows.length + parsed.movies.length;
    return {
      groups,
      counts: { total, matched: total - unresolved, unresolved, apiErrors: 0 },
      searchDomain: Domain.MEDIA,
    };
  }

  async commit(
    userId: string,
    parsed: TParsed,
    plan: ImportPlan,
    decisions: CommitDecisions,
    progress: ProgressReporter,
  ): Promise<ImportReport> {
    const matchByKey = indexPlanMatches(plan);
    const includedShows = parsed.shows.filter((s) =>
      decisions.include.has(showKey(s)),
    );
    const includedMovies = parsed.movies.filter((m) =>
      decisions.include.has(movieKey(m)),
    );
    progress.setTotal(includedShows.length + includedMovies.length);

    const tally: CommitTally = {
      showsImported: 0,
      showsWatchlist: 0,
      episodesCreated: 0,
      moviesImported: 0,
      moviesWatchlist: 0,
    };

    if (decisions.overwrite) {
      await this.prisma.$transaction([
        this.prisma.episodeWatch.deleteMany({ where: { userId } }),
        this.prisma.libraryEntry.deleteMany({ where: { userId } }),
      ]);
    }

    for (const show of includedShows) {
      const match = this.resolvedMatch(showKey(show), decisions, matchByKey);

      if (match) {
        try {
          await this.writeShow(userId, show, match, tally);
        } catch (error) {
          throw this.contextualize(error, show.title);
        }
      }

      progress.tick();
    }

    for (const movie of includedMovies) {
      const match = this.resolvedMatch(movieKey(movie), decisions, matchByKey);

      if (match) {
        try {
          await this.writeMovie(userId, movie, match, tally);
        } catch (error) {
          throw this.contextualize(error, movie.title);
        }
      }

      progress.tick();
    }

    return {
      overwrite: decisions.overwrite,
      tiles: [
        {
          label: "Séries",
          value: tally.showsImported,
          sub: `${tally.showsWatchlist} en watchlist`,
        },
        {
          label: "Épisodes",
          value: tally.episodesCreated,
          sub: "visionnages créés",
        },
        {
          label: "Films",
          value: tally.moviesImported,
          sub: `${tally.moviesWatchlist} en watchlist`,
        },
      ],
    };
  }

  /** Logs and re-throws a commit-time failure with the title it happened on. */
  private contextualize(error: unknown, title: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to import "${title}": ${message}`);
    return new Error(`"${title}": ${message}`, { cause: error });
  }

  /** The write target for a key: a manual override wins over the auto-match. */
  private resolvedMatch(
    key: string,
    decisions: CommitDecisions,
    matchByKey: Map<string, ResolvedMatch>,
  ): ResolvedMatch | null {
    const override = decisions.overrides.get(key);

    if (override && override.type) {
      return {
        source: override.source as CatalogSource,
        sourceId: override.sourceId,
        type: override.type,
      };
    }

    return matchByKey.get(key) ?? null;
  }

  /**
   * Resolve a show to a catalogue match: a TMDB id (when the source has one)
   * settles it in a single call; otherwise fall back to TVDB, then IMDb.
   */
  private async resolveShowMatch(
    show: ImportShow,
  ): Promise<ImportMatch | null> {
    const { tmdb, tvdb, imdb } = show.externalIds;

    if (tmdb) {
      try {
        return toMatch(await this.tmdb.getSeriesSummaryByTmdbId(tmdb));
      } catch {
        // Stale/removed id — fall through to the next external id.
      }
    }

    if (tvdb) {
      try {
        const summary = await this.tmdb.findSeriesSummaryByTvdbId(tvdb);
        if (summary) return toMatch(summary);
      } catch {
        // Fall through.
      }
    }

    if (imdb) {
      try {
        const summary = await this.tmdb.findSeriesSummaryByImdbId(imdb);
        if (summary) return toMatch(summary);
      } catch {
        // Fall through.
      }
    }

    return null;
  }

  /**
   * Resolve a movie to a catalogue match: TMDB id, then IMDb id, then a
   * confident title/year search as a last resort (TV Time carries neither id).
   */
  private async resolveMovieMatch(
    movie: ImportMovie,
  ): Promise<ImportMatch | null> {
    const { tmdb, imdb } = movie.externalIds;

    if (tmdb) {
      try {
        return toMatch(await this.tmdb.getMovieSummaryByTmdbId(tmdb));
      } catch {
        // Fall through.
      }
    }

    if (imdb) {
      try {
        const summary = await this.tmdb.findMovieSummaryByImdbId(imdb);
        if (summary) return toMatch(summary);
      } catch {
        // Fall through.
      }
    }

    try {
      const summaries = await this.tmdb.search(movie.title, "MOVIE");
      const match = pickMovie(summaries, movie.title, movie.year);
      return match ? toMatch(match) : null;
    } catch {
      return null;
    }
  }

  /** Write one show against an already-resolved catalogue match. */
  private async writeShow(
    userId: string,
    show: ImportShow,
    match: ResolvedMatch,
    tally: CommitTally,
  ): Promise<void> {
    if (show.episodes.length === 0) {
      await this.mediaItemService.upsertFromSource(
        match.source,
        match.sourceId,
        match.type,
      );
      await this.upsertSeriesEntry(
        userId,
        match.source,
        match.sourceId,
        match.type,
        "PLANNED",
        show,
      );
      tally.showsWatchlist++;
      return;
    }

    const index = await this.persistSeriesIndex(
      match.source,
      match.sourceId,
      match.type,
    );

    let watchedRegular = 0;

    for (const ep of show.episodes) {
      const episodeId = index.byKey.get(`${ep.season}|${ep.episode}`);
      if (episodeId === undefined) continue; // numbering gap — no target
      if (ep.season > 0) watchedRegular++;
      tally.episodesCreated += await this.recordWatches(
        userId,
        episodeId,
        ep.totalWatches,
        ep.watchedAt,
      );
    }

    const status = entryStatusFromProgress(watchedRegular, index.totalRegular);
    await this.upsertSeriesEntry(
      userId,
      match.source,
      match.sourceId,
      match.type,
      status,
      show,
    );
    if (status === "PLANNED") tally.showsWatchlist++;
    else tally.showsImported++;
  }

  /** Write one movie against an already-resolved catalogue match. */
  private async writeMovie(
    userId: string,
    movie: ImportMovie,
    match: ResolvedMatch,
    tally: CommitTally,
  ): Promise<void> {
    const status: EntryStatus = movie.watched ? "COMPLETED" : "PLANNED";
    // A movie is a single sitting — start and finish share the same instant.
    const watchedAt = movie.watched ? movie.watchedAt : null;
    const media = await this.mediaItemService.upsertFromSource(
      match.source,
      match.sourceId,
      match.type,
    );
    await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
      update: { status, startedAt: watchedAt, finishedAt: watchedAt },
      create: {
        userId,
        mediaItemId: media.id,
        status,
        startedAt: watchedAt,
        finishedAt: watchedAt,
      },
    });
    if (status === "PLANNED") tally.moviesWatchlist++;
    else tally.moviesImported++;
  }

  /** Persist the series (on-demand cache) and index its stored episodes. */
  private async persistSeriesIndex(
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
  ): Promise<EpisodeIndex> {
    const media = await this.mediaItemService.upsertFromSource(
      source,
      sourceId,
      type,
    );
    const seasons = await this.prisma.season.findMany({
      where: { mediaItemId: media.id },
      include: { episodes: { select: { id: true, number: true } } },
    });

    const byKey = new Map<string, string>();
    let totalRegular = 0;

    for (const season of seasons) {
      for (const episode of season.episodes) {
        byKey.set(`${season.number}|${episode.number}`, episode.id);
        if (season.number > 0) totalRegular++;
      }
    }

    return { byKey, totalRegular };
  }

  /** Create the missing watch rows for an episode; skip if already imported. */
  private async recordWatches(
    userId: string,
    episodeId: string,
    totalWatches: number,
    watchedAt: Date | null,
  ): Promise<number> {
    const existing = await this.prisma.episodeWatch.count({
      where: { userId, episodeId },
    });
    if (existing > 0) return 0; // Idempotent re-run.

    await this.prisma.episodeWatch.createMany({
      data: Array.from({ length: totalWatches }, () => ({
        userId,
        episodeId,
        watchedAt: watchedAt ?? undefined,
      })),
    });
    return totalWatches;
  }

  private async upsertSeriesEntry(
    userId: string,
    source: CatalogSource,
    sourceId: string,
    type: MediaType,
    status: EntryStatus,
    show: ImportShow,
  ): Promise<void> {
    const ref = await this.prisma.mediaExternalId.findUnique({
      where: {
        source_externalId_type: {
          source: source as DbExternalSource,
          externalId: sourceId,
          type,
        },
      },
    });
    if (!ref) return; // upsertFromSource ran just before, so this always exists.

    const { startedAt, finishedAt } = watchWindow(show, status === "COMPLETED");
    await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: ref.mediaItemId } },
      update: { status, startedAt, finishedAt },
      create: {
        userId,
        mediaItemId: ref.mediaItemId,
        status,
        startedAt,
        finishedAt,
      },
    });
  }
}

/** Stable per-item id carried through analyze → review → commit. */
function showKey(show: ImportShow): string {
  const { tvdb, tmdb, imdb, anilist } = show.externalIds;
  if (tvdb) return `tvdb:${tvdb}`;
  if (tmdb) return `tmdb:${tmdb}`;
  if (imdb) return `imdb:${imdb}`;
  if (anilist) return `anilist:${anilist}`;
  return `show:${show.title.toLowerCase()}`;
}

function movieKey(movie: ImportMovie): string {
  const { tmdb, imdb } = movie.externalIds;
  if (tmdb) return `tmdb:${tmdb}`;
  if (imdb) return `imdb:${imdb}`;
  return `movie:${movie.title.toLowerCase()}:${movie.year ?? ""}`;
}

/** Flatten a plan's auto-resolved matches into a key → write-target lookup. */
function indexPlanMatches(plan: ImportPlan): Map<string, ResolvedMatch> {
  const byKey = new Map<string, ResolvedMatch>();

  for (const group of plan.groups) {
    for (const item of group.items) {
      if (item.match && item.match.type) {
        byKey.set(item.key, {
          source: item.match.source as CatalogSource,
          sourceId: item.match.sourceId,
          type: item.match.type,
        });
      }
    }
  }

  return byKey;
}

function toMatch(summary: MediaSummaryDto): ImportMatch {
  return {
    source: summary.source,
    sourceId: summary.sourceId,
    type: summary.type,
    title: summary.title,
    year: summary.year,
    coverUrl: summary.posterUrl,
  };
}

/** Earliest and latest watch dates; finishedAt only makes sense when complete. */
function watchWindow(
  show: ImportShow,
  completed: boolean,
): { startedAt: Date | null; finishedAt: Date | null } {
  const dates = show.episodes
    .map((e) => e.watchedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return { startedAt: null, finishedAt: null };
  return {
    startedAt: dates[0],
    finishedAt: completed ? dates[dates.length - 1] : null,
  };
}

/**
 * Confident movie match only: exact (case-insensitive) title, preferring a
 * matching year. Exports carry original-language titles while TMDB's `title`
 * is localized (en-US), so we also accept a hit on `originalTitle`. Anything
 * fuzzier is left for manual validation.
 */
function pickMovie(
  summaries: MediaSummaryDto[],
  title: string,
  year: number | null,
): MediaSummaryDto | null {
  const norm = (s: string) => s.toLowerCase().trim();
  const query = norm(title);
  const exact = summaries.filter(
    (s) =>
      norm(s.title) === query ||
      (s.originalTitle !== null && norm(s.originalTitle || "") === query),
  );
  if (exact.length === 0) return null;

  if (year !== null) {
    const sameYear = exact.find(
      (s) => s.year !== null && Math.abs(s.year - year) <= 1,
    );
    if (sameYear) return sameYear;
  }

  return exact[0];
}
