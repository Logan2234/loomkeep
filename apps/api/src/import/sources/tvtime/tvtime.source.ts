import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { ExternalSource as DbExternalSource } from "@prisma/client";
import type {
  CatalogSource,
  EntryStatus,
  ImportMatch,
  ImportPlan,
  ImportPlanGroup,
  ImportPlanItem,
  ImportReport,
  MediaSummaryDto,
  MediaType,
  TvTimeImportFilesDto,
} from "@loomkeep/shared";
import { entryStatusFromProgress } from "@loomkeep/shared";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CommitDecisions,
  ImportSource,
  ProgressReporter,
} from "../../import-source";
import type {
  ImportMovie,
  ImportShow,
  ParsedImport,
} from "../../media-import-model";
import {
  parseTvTimeExport,
  type ParsedMovie,
  type ParsedShow,
} from "./parse-export";
import { readZipEntries } from "./zip";

/** Each import field → its file name in the TV Time GDPR export. */
const FILE_NAMES: Record<keyof TvTimeImportFilesDto, string> = {
  episodesCsv: "tracking-prod-records-v2.csv",
  showsCsv: "user_tv_show_data.csv",
  recordsCsv: "tracking-prod-records.csv",
  rewatchedCsv: "rewatched_episode.csv",
};

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
 * TV Time GDPR export (`.zip` of CSVs), reconciled through TVDB ids. The
 * reference {@link ImportSource}: shows/movies parsed into the media model,
 * resolved against TMDB, then written as library entries + episode watches.
 */
@Injectable()
export class TvTimeImportSource implements ImportSource<ParsedImport> {
  private readonly logger = new Logger(TvTimeImportSource.name);
  readonly id = "tvtime";
  readonly searchDomain = "media" as const;
  readonly supportsOverwrite = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaItemService: MediaItemService,
    private readonly tmdb: TmdbProvider,
  ) {}

  parseInput(input: string, options: Record<string, boolean>): ParsedImport {
    const importMovies = options.importMovies ?? true;
    const files = extractFiles(Buffer.from(input, "base64"));
    const { shows, movies } = parseTvTimeExport(files);
    return {
      source: this.id,
      shows: shows.map(toImportShow),
      movies: importMovies ? movies.map(toImportMovie) : [],
    };
  }

  async buildPlan(
    _userId: string,
    parsed: ParsedImport,
    progress: ProgressReporter,
  ): Promise<ImportPlan> {
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
      searchDomain: "media",
    };
  }

  async commit(
    userId: string,
    parsed: ParsedImport,
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

  /** Resolve a show to a catalogue match (via its TVDB id); null if none. */
  private async resolveShowMatch(
    show: ImportShow,
  ): Promise<ImportMatch | null> {
    const tvdbId = show.externalIds.tvdb;
    if (!tvdbId) return null;

    try {
      const summary = await this.tmdb.findSeriesSummaryByTvdbId(tvdbId);
      return summary ? toMatch(summary) : null;
    } catch {
      return null;
    }
  }

  /** Resolve a movie to a confident catalogue match; null if none. */
  private async resolveMovieMatch(
    movie: ImportMovie,
  ): Promise<ImportMatch | null> {
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
    const media = await this.mediaItemService.upsertFromSource(
      match.source,
      match.sourceId,
      match.type,
    );
    await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
      update: { status },
      create: { userId, mediaItemId: media.id, status },
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

function toImportShow(show: ParsedShow): ImportShow {
  return {
    title: show.name,
    externalIds: { tvdb: show.tvdbId },
    episodes: show.episodes.map((e) => ({
      season: e.season,
      episode: e.episode,
      sourceEpisodeId: e.tvdbEpisodeId,
      watchedAt: e.watchedAt,
      totalWatches: e.totalWatches,
    })),
  };
}

function toImportMovie(movie: ParsedMovie): ImportMovie {
  return {
    title: movie.title,
    year: movie.year,
    watched: movie.watched,
    externalIds: {},
  };
}

/**
 * Decode + validate the archive and extract the CSVs we need. Throws
 * {@link BadRequestException} on a bad or incomplete archive. Movies are
 * optional: their file may be absent (then there are simply no movies).
 */
function extractFiles(input: Buffer): TvTimeImportFilesDto {
  if (input.length === 0) {
    throw new BadRequestException("The uploaded archive is empty");
  }

  let entries: Map<string, string>;

  try {
    entries = readZipEntries(input, new Set(Object.values(FILE_NAMES)));
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "Could not read the archive",
    );
  }

  const files: TvTimeImportFilesDto = {
    episodesCsv: entries.get(FILE_NAMES.episodesCsv),
    showsCsv: entries.get(FILE_NAMES.showsCsv),
    recordsCsv: entries.get(FILE_NAMES.recordsCsv),
    rewatchedCsv: entries.get(FILE_NAMES.rewatchedCsv),
  };

  const missing: string[] = [];
  if (!files.episodesCsv) missing.push(FILE_NAMES.episodesCsv);
  if (!files.showsCsv) missing.push(FILE_NAMES.showsCsv);

  if (missing.length > 0) {
    throw new BadRequestException(
      `Missing required file(s) in the archive: ${missing.join(", ")}`,
    );
  }

  return files;
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
 * matching year. The export carries original-language titles while TMDB's
 * `title` is localized (en-US), so we also accept a hit on `originalTitle`.
 * Anything fuzzier is left for manual validation.
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
