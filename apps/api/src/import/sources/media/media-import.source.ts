import type {
  CatalogSource,
  EntryStatus,
  ImportPlan,
  ImportPlanGroup,
  ImportPlanItem,
  ImportReport,
  ImportSource,
  MediaType,
} from "@loomkeep/shared";
import {
  Domain,
  entryStatusFromProgress,
  REVIEW_TEXT_MAX_LENGTH,
  ReviewTargetType,
} from "@loomkeep/shared";
import { Logger } from "@nestjs/common";
import type { ExternalSource as DbExternalSource } from "@prisma/client";
import { MediaItemService } from "../../../catalog/media-item.service";
import { mapWithConcurrency } from "../../../common/concurrency.util";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type {
  CommitDecisions,
  ImportReq,
  ProgressReporter,
} from "../../import-source";
import type {
  ImportList,
  ImportListFilm,
  ImportMovie,
  ImportShow,
  ParsedImport,
} from "../../media-import-model";
import type { MediaImportMatchResolver } from "./media-match-resolver";

/** A catalogue match resolved to its required media type, ready to write. */
export type ResolvedMatch = {
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

// Shows/movies are resolved against the catalogue a few at a time — fast
// enough for a typical export while staying polite to the TMDB API.
const RESOLVE_CONCURRENCY = 5;

/** Running tallies a commit turns into the report tiles. */
interface CommitTally {
  showsImported: number;
  showsWatchlist: number;
  episodesCreated: number;
  moviesImported: number;
  moviesWatchlist: number;
  listsCreated: number;
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
  protected readonly manualSearchMediaType?: MediaType;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly mediaItemService: MediaItemService,
    protected readonly matchResolver: MediaImportMatchResolver,
    protected readonly reviews: ReviewService,
  ) {}

  abstract parseInput(input: string): TParsed;

  /**
   * Hook for sources whose export can only be fetched over the network
   * rather than parsed synchronously in {@link parseInput}:
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
    // Films reachable only through a list still need resolving, so they are
    // counted up front — the keys are derivable without any match.
    const listOnlyFilms = collectListOnlyFilms(parsed);
    progress.setTotal(
      parsed.shows.length + parsed.movies.length + listOnlyFilms.length,
    );

    const seriesTracked: ImportPlanItem[] = [];
    const seriesWatchlist: ImportPlanItem[] = [];
    const moviesWatched: ImportPlanItem[] = [];
    const moviesWatchlist: ImportPlanItem[] = [];
    let unresolved = 0;

    const showMatches = await mapWithConcurrency(
      parsed.shows,
      RESOLVE_CONCURRENCY,
      async (show) => {
        const match = await this.matchResolver.resolveShow(show);
        progress.tick();
        return match;
      },
    );

    parsed.shows.forEach((show, i) => {
      const match = showMatches[i];
      if (!match) unresolved++;
      const n = show.episodes.length;
      const subtitle = [
        n > 0
          ? `${n} épisode${n > 1 ? "s" : ""} vu${n > 1 ? "s" : ""}`
          : "Watchlist",
        ...extraParts(show.rating, show.favorite, 0),
      ].join(" · ");
      const item: ImportPlanItem = {
        key: showKey(show),
        title: match?.title ?? show.title,
        sourceTitle: show.title,
        subtitle,
        context: {
          kind: "series",
          episodesWatched: n,
          rating: show.rating ?? null,
          favorite: show.favorite ?? false,
        },
        coverUrl: match?.coverUrl ?? null,
        match,
        include: match !== null,
        alreadyInLibrary: false,
        defaultStatus: null,
      };
      (n === 0 ? seriesWatchlist : seriesTracked).push(item);
    });

    const movieMatches = await mapWithConcurrency(
      parsed.movies,
      RESOLVE_CONCURRENCY,
      async (movie) => {
        const match = await this.matchResolver.resolveMovie(movie);
        progress.tick();
        return match;
      },
    );

    parsed.movies.forEach((movie, i) => {
      const match = movieMatches[i];
      if (!match) unresolved++;
      const subtitleParts = [
        movie.year ? String(movie.year) : null,
        ...extraParts(movie.rating, movie.favorite, movie.rewatchedAt.length),
      ].filter((p): p is string => p !== null);
      const item: ImportPlanItem = {
        key: movieKey(movie),
        title: match?.title ?? movie.title,
        sourceTitle: movie.title,
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : null,
        context: {
          kind: "movie",
          year: movie.year,
          rewatches: movie.rewatchedAt.length,
          rating: movie.rating ?? null,
          favorite: movie.favorite ?? false,
        },
        coverUrl: match?.coverUrl ?? null,
        match,
        include: match !== null,
        alreadyInLibrary: false,
        defaultStatus: null,
      };
      (movie.watched ? moviesWatched : moviesWatchlist).push(item);
    });

    const listFilms: ImportPlanItem[] = [];
    const listMatches = await mapWithConcurrency(
      listOnlyFilms,
      RESOLVE_CONCURRENCY,
      async (film) => {
        const match =
          film.type === "SERIES"
            ? await this.matchResolver.resolveShow(asShow(film))
            : await this.matchResolver.resolveMovie(asMovie(film));
        progress.tick();
        return match;
      },
    );

    listOnlyFilms.forEach((film, i) => {
      const match = listMatches[i];
      if (!match) unresolved++;
      listFilms.push({
        key: movieKey(film),
        title: match?.title ?? film.title,
        sourceTitle: film.title,
        subtitle: film.year ? String(film.year) : null,
        context: {
          kind: "movie",
          year: film.year,
          rewatches: 0,
          rating: null,
          favorite: false,
        },
        coverUrl: match?.coverUrl ?? null,
        match,
        include: match !== null,
        alreadyInLibrary: false,
        defaultStatus: null,
      });
    });

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
      { id: "listFilms", label: "Films de tes listes", items: listFilms },
    ].filter((g) => g.items.length > 0);

    const total =
      parsed.shows.length + parsed.movies.length + listOnlyFilms.length;
    return {
      groups,
      counts: { total, matched: total - unresolved, unresolved, apiErrors: 0 },
      searchDomain: Domain.MEDIA,
      searchMediaType: this.manualSearchMediaType,
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
      listsCreated: 0,
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

    if (parsed.lists && parsed.lists.length > 0) {
      await this.writeLists(userId, parsed.lists, decisions, matchByKey, tally);
    }

    return {
      overwrite: decisions.overwrite,
      tiles: [
        {
          label: "Séries",
          id: "series",
          watchlistCount: tally.showsWatchlist,
          value: tally.showsImported,
          sub: `${tally.showsWatchlist} en watchlist`,
        },
        {
          label: "Épisodes",
          id: "episodes",
          value: tally.episodesCreated,
          sub: "visionnages créés",
        },
        {
          label: "Films",
          id: "movies",
          watchlistCount: tally.moviesWatchlist,
          value: tally.moviesImported,
          sub: `${tally.moviesWatchlist} en watchlist`,
        },
        ...(tally.listsCreated > 0
          ? [
              {
                label: "Listes",
                id: "lists" as const,
                value: tally.listsCreated,
                sub: null,
              },
            ]
          : []),
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
  protected resolvedMatch(
    key: string,
    decisions: CommitDecisions,
    matchByKey: Map<string, ResolvedMatch>,
  ): ResolvedMatch | null {
    const override = decisions.overrides.get(key);

    if (override && override.type) {
      const match = {
        source: override.source as CatalogSource,
        sourceId: override.sourceId,
        type: override.type,
      };
      return this.acceptsMatch(match) ? match : null;
    }

    const match = matchByKey.get(key) ?? null;
    return match && this.acceptsMatch(match) ? match : null;
  }

  /** Sources may constrain manual overrides to a single catalogue. */
  protected acceptsMatch(_match: ResolvedMatch): boolean {
    return true;
  }

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
        show.status ?? "PLANNED",
        show,
      );
      if ((show.status ?? "PLANNED") === "PLANNED") tally.showsWatchlist++;
      else tally.showsImported++;
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
      // IMDb rates episodes individually; the rating belongs to the episode,
      // not to the show (ReviewTargetType.EPISODE).
      await this.writeRating(
        userId,
        ReviewTargetType.EPISODE,
        episodeId,
        ep.rating,
      );
    }

    const status =
      show.status ??
      entryStatusFromProgress(watchedRegular, index.totalRegular);
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
    // Only ever turns favorite ON — an importer never has grounds to unset
    // something the user set manually in the app.
    const favorite = movie.favorite === true;
    const entry = await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
      update: {
        status,
        startedAt: watchedAt,
        finishedAt: watchedAt,
        favorite: favorite ? true : undefined,
        notes: movie.notes ?? undefined,
      },
      create: {
        userId,
        mediaItemId: media.id,
        status,
        startedAt: watchedAt,
        finishedAt: watchedAt,
        favorite,
        notes: movie.notes ?? null,
        // The date the user added it on the source, so "recently added" keeps
        // meaning something after an import. Only on create: an existing entry
        // already has the user's own history.
        createdAt: movie.addedAt ?? undefined,
      },
    });

    if (movie.watched && movie.rewatchedAt.length > 0) {
      await this.recordMovieReplays(entry.id, movie.rewatchedAt);
    }

    await this.writeRating(
      userId,
      ReviewTargetType.MEDIA,
      media.id,
      movie.rating,
      movie.review,
    );

    if (status === "PLANNED") tally.moviesWatchlist++;
    else tally.moviesImported++;
  }

  /**
   * Writes the source's rating, carrying its review body when there is one.
   *
   * A review needs a rating to exist at all (`Review.rating` is mandatory), so
   * text without stars — possible on Letterboxd — is dropped rather than
   * invented as a 0. Visibility is left to `upsert`, which applies the user's
   * own default: an import must not decide who sees their writing.
   */
  private async writeRating(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
    rating: number | null | undefined,
    review?: string | null,
  ): Promise<void> {
    if (rating === null || rating === undefined) return;

    if (review) {
      await this.reviews.upsert(userId, targetType, targetId, {
        rating,
        text: review.slice(0, REVIEW_TEXT_MAX_LENGTH),
      });
      return;
    }

    await this.reviews.setRating(userId, targetType, targetId, rating);
  }

  /**
   * Recreates the source's custom lists, reusing the matches the plan already
   * settled so a list never re-resolves a film.
   *
   * A list whose title the user already has is skipped rather than merged: a
   * re-run must not append the same films twice, and quietly editing a list
   * they have since curated would be worse than doing nothing.
   */
  private async writeLists(
    userId: string,
    lists: ImportList[],
    decisions: CommitDecisions,
    matchByKey: Map<string, ResolvedMatch>,
    tally: CommitTally,
  ): Promise<void> {
    for (const list of lists) {
      const existing = await this.prisma.list.findFirst({
        where: { userId, title: list.name },
        select: { id: true },
      });
      if (existing) continue;

      const targetIds: string[] = [];

      for (const film of list.items) {
        const key = movieKey(film);
        if (!decisions.include.has(key)) continue;

        const match = this.resolvedMatch(key, decisions, matchByKey);
        if (!match) continue;

        try {
          const media = await this.mediaItemService.upsertFromSource(
            match.source,
            match.sourceId,
            match.type,
          );
          if (!targetIds.includes(media.id)) targetIds.push(media.id);
        } catch (error) {
          throw this.contextualize(error, film.title);
        }
      }

      if (targetIds.length === 0) continue;

      await this.prisma.list.create({
        data: {
          userId,
          title: list.name,
          description: list.description,
          kind: list.ranked ? "RANKED" : "COLLECTION",
          items: {
            create: targetIds.map((targetId, index) => ({
              targetType: ReviewTargetType.MEDIA,
              targetId,
              position: index,
            })),
          },
        },
      });
      tally.listsCreated++;
    }
  }

  private async recordMovieReplays(
    libraryEntryId: string,
    dates: Date[],
  ): Promise<void> {
    const existing = await this.prisma.movieReplay.count({
      where: { libraryEntryId },
    });
    if (existing > 0) return; // Idempotent re-run.

    await this.prisma.movieReplay.createMany({
      data: dates.map((finishedAt) => ({ libraryEntryId, finishedAt })),
    });
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
        watchedAt,
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

    const inferredWindow = watchWindow(show, status === "COMPLETED");
    const startedAt = show.startedAt ?? inferredWindow.startedAt;
    const finishedAt = show.finishedAt ?? inferredWindow.finishedAt;
    // Only ever turns favorite ON — an importer never has grounds to unset
    // something the user set manually in the app.
    const favorite = show.favorite === true;
    await this.prisma.libraryEntry.upsert({
      where: { userId_mediaItemId: { userId, mediaItemId: ref.mediaItemId } },
      update: {
        status,
        startedAt,
        finishedAt,
        favorite: favorite ? true : undefined,
        notes: show.notes ?? undefined,
        ownershipStatus: show.ownershipStatus,
        ownershipSource: show.ownershipSource,
      },
      create: {
        userId,
        mediaItemId: ref.mediaItemId,
        status,
        startedAt,
        finishedAt,
        favorite,
        notes: show.notes ?? null,
        ownershipStatus: show.ownershipStatus ?? "NONE",
        ownershipSource: show.ownershipSource ?? null,
      },
    });

    if (show.rating !== null && show.rating !== undefined) {
      await this.reviews.setRating(
        userId,
        ReviewTargetType.MEDIA,
        ref.mediaItemId,
        show.rating,
      );
    }
  }
}

/** Extra badges surfaced in the plan preview: rewatch count, rating, favorite. */
function extraParts(
  rating: number | null | undefined,
  favorite: boolean | undefined,
  rewatchCount: number,
): string[] {
  const parts: string[] = [];
  if (rewatchCount > 0) parts.push(`revu ${rewatchCount + 1}×`);
  if (rating !== null && rating !== undefined) parts.push(`★ ${rating}/10`);
  if (favorite) parts.push("♥ favori");
  return parts;
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

function movieKey(
  movie: Pick<ImportMovie, "title" | "year" | "externalIds">,
): string {
  const { tmdb, imdb } = movie.externalIds;
  if (tmdb) return `tmdb:${tmdb}`;
  if (imdb) return `imdb:${imdb}`;
  return `movie:${movie.title.toLowerCase()}:${movie.year ?? ""}`;
}

/**
 * List entries no show/movie entry already covers, deduplicated.
 *
 * `showKey` and `movieKey` agree on an `imdb:`/`tmdb:` prefix, so a title that
 * is both tracked and listed is recognised as one item whichever it is.
 */
function collectListOnlyFilms(parsed: ParsedImport): ImportListFilm[] {
  const covered = new Set<string>([
    ...parsed.shows.map(showKey),
    ...parsed.movies.map(movieKey),
  ]);
  const films: ImportListFilm[] = [];

  for (const list of parsed.lists ?? []) {
    for (const film of list.items) {
      const key = movieKey(film);
      if (covered.has(key)) continue;
      covered.add(key);
      films.push(film);
    }
  }

  return films;
}

/** A list entry as the matcher's input, which reads nothing else. */
function asMovie(film: ImportListFilm): ImportMovie {
  return { ...film, watched: false, watchedAt: null, rewatchedAt: [] };
}

function asShow(film: ImportListFilm): ImportShow {
  return { title: film.title, externalIds: film.externalIds, episodes: [] };
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
