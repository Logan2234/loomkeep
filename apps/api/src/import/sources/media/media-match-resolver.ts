import type { ImportMatch, MediaSummaryDto } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import type { ImportMovie, ImportShow } from "../../media-import-model";

/**
 * Resolves a media import's raw shows/movies against the TMDB catalogue.
 * Split out of {@link MediaImportSource} so the resolution rules (which
 * external id to try first, when to fall back to a title/year search) can be
 * tested in isolation from the plan/commit mechanics.
 */
@Injectable()
export class MediaMatchResolver {
  constructor(private readonly tmdb: TmdbProvider) {}

  /**
   * Resolve a show to a catalogue match: a TMDB id (when the source has one)
   * settles it in a single call; otherwise fall back to TVDB, then IMDb.
   */
  async resolveShow(show: ImportShow): Promise<ImportMatch | null> {
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
  async resolveMovie(movie: ImportMovie): Promise<ImportMatch | null> {
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
