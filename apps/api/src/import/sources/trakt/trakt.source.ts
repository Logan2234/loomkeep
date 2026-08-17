import { BadRequestException, Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ParsedImport } from "../../media-import-model";
import { readZipEntriesMatching } from "../../zip";
import { MediaImportSource } from "../media/media-import.source";
import { buildImportMovies, buildImportShows } from "./parse-trakt-export";
import type {
  TraktHistoryEntry,
  TraktWatchlistEntry,
} from "./trakt-export.types";

const WATCHLIST_FILE = "lists-watchlist.json";

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
  ) {
    super(prisma, mediaItemService, tmdb);
  }

  parseInput(input: string): ParsedImport {
    const { history, watchlist } = extractFiles(Buffer.from(input, "base64"));
    return {
      source: this.id,
      shows: buildImportShows(history, watchlist),
      movies: buildImportMovies(history, watchlist),
    };
  }
}

/**
 * Decode + validate the archive and extract the watch-history parts + the
 * (optional) watchlist. Throws {@link BadRequestException} on a bad or
 * incomplete archive.
 */
function extractFiles(input: Buffer): {
  history: TraktHistoryEntry[];
  watchlist: TraktWatchlistEntry[];
} {
  if (input.length === 0) {
    throw new BadRequestException("The uploaded archive is empty");
  }

  let entries: Map<string, string>;

  try {
    entries = readZipEntriesMatching(
      input,
      (name) => name.startsWith("watched-history") || name === WATCHLIST_FILE,
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

  let history: TraktHistoryEntry[];
  let watchlist: TraktWatchlistEntry[];

  try {
    history = historyFiles.flatMap(
      ([, content]) => JSON.parse(content) as TraktHistoryEntry[],
    );
    const watchlistJson = entries.get(WATCHLIST_FILE);
    watchlist = watchlistJson
      ? (JSON.parse(watchlistJson) as TraktWatchlistEntry[])
      : [];
  } catch {
    throw new BadRequestException(
      "Could not read the archive — one of its JSON files is malformed",
    );
  }

  return { history, watchlist };
}
