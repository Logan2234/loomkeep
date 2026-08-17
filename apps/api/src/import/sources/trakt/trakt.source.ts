import { BadRequestException, Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type { ParsedImport } from "../../media-import-model";
import { readZipEntriesMatching } from "../../zip";
import { MediaImportSource } from "../media/media-import.source";
import { buildImportMovies, buildImportShows } from "./parse-trakt-export";
import type {
  TraktFavoriteEntry,
  TraktHistoryEntry,
  TraktMovieRatingEntry,
  TraktShowRatingEntry,
  TraktWatchlistEntry,
} from "./trakt-export.types";

const WATCHLIST_FILE = "lists-watchlist.json";
const FAVORITES_FILE = "lists-favorites.json";
const MOVIE_RATINGS_FILE = "ratings-movies.json";
const SHOW_RATINGS_FILE = "ratings-shows.json";

/**
 * Trakt's own account data export (`.zip` of many small JSON files, from
 * Settings → Data → Export on trakt.tv) — free-tier, unlike the live API
 * (whose Client ID now requires Trakt VIP to create, so that path isn't
 * viable). The export is fully parsed synchronously in {@link parseInput};
 * the shared resolve/plan/commit mechanics live in {@link MediaImportSource}.
 */
@Injectable()
export class TraktImportSource extends MediaImportSource<ParsedImport> {
  readonly id = "trakt";

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    tmdb: TmdbProvider,
    reviews: ReviewService,
  ) {
    super(prisma, mediaItemService, tmdb, reviews);
  }

  parseInput(input: string): ParsedImport {
    const { history, watchlist, favorites, movieRatings, showRatings } =
      extractFiles(Buffer.from(input, "base64"));
    return {
      source: this.id,
      shows: buildImportShows(history, watchlist, favorites, showRatings),
      movies: buildImportMovies(history, watchlist, favorites, movieRatings),
    };
  }
}

/**
 * Decode + validate the archive and extract the watch-history parts + the
 * (optional) watchlist/favorites/ratings. Throws {@link BadRequestException}
 * on a bad or incomplete archive.
 */
function extractFiles(input: Buffer): {
  history: TraktHistoryEntry[];
  watchlist: TraktWatchlistEntry[];
  favorites: TraktFavoriteEntry[];
  movieRatings: TraktMovieRatingEntry[];
  showRatings: TraktShowRatingEntry[];
} {
  if (input.length === 0) {
    throw new BadRequestException("The uploaded archive is empty");
  }

  let entries: Map<string, string>;

  try {
    entries = readZipEntriesMatching(
      input,
      (name) =>
        name.startsWith("watched-history") ||
        name === WATCHLIST_FILE ||
        name === FAVORITES_FILE ||
        name === MOVIE_RATINGS_FILE ||
        name === SHOW_RATINGS_FILE,
    );
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : "Could not read the archive",
    );
  }

  // A small library gets the unsplit `watched-history.json`; a larger one is
  // paginated into `watched-history-1.json`, `-2.json`, etc. — either way,
  // every part starts with the same prefix.
  const historyFiles = [...entries.entries()].filter(([name]) =>
    name.startsWith("watched-history"),
  );

  if (historyFiles.length === 0) {
    throw new BadRequestException(
      "Missing required file(s) in the archive: watched-history.json (or watched-history-N.json)",
    );
  }

  try {
    const history = historyFiles.flatMap(
      ([, content]) => JSON.parse(content) as TraktHistoryEntry[],
    );
    return {
      history,
      watchlist: parseJsonEntry<TraktWatchlistEntry[]>(entries, WATCHLIST_FILE),
      favorites: parseJsonEntry<TraktFavoriteEntry[]>(entries, FAVORITES_FILE),
      movieRatings: parseJsonEntry<TraktMovieRatingEntry[]>(
        entries,
        MOVIE_RATINGS_FILE,
      ),
      showRatings: parseJsonEntry<TraktShowRatingEntry[]>(
        entries,
        SHOW_RATINGS_FILE,
      ),
    };
  } catch {
    throw new BadRequestException(
      "Could not read the archive — one of its JSON files is malformed",
    );
  }
}

/** Parses an optional JSON entry from the archive; `[]` when absent. */
function parseJsonEntry<T>(entries: Map<string, string>, name: string): T {
  const json = entries.get(name);
  return json ? (JSON.parse(json) as T) : ([] as T);
}
