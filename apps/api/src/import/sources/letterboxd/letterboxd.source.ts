import { CatalogSource, MediaType } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type { ParsedImport } from "../../media-import-model";
import { readZipEntriesByPath } from "../../zip";
import {
  MediaImportSource,
  type ResolvedMatch,
} from "../media/media-import.source";
import { MediaMatchResolver } from "../media/media-match-resolver";
import {
  LETTERBOXD_FILES,
  parseLetterboxdExport,
} from "./parse-letterboxd-export";

/** The archive members worth extracting, as path suffixes. */
const WANTED_FILES: readonly string[] = Object.values(LETTERBOXD_FILES);

/**
 * Letterboxd's data export (`.zip` of CSVs) — films only, reconciled through
 * TMDB by title and year since the export carries no identifiers.
 *
 * `deleted/` and `orphaned/` are skipped on purpose: they hold entries the user
 * removed, and re-importing them would resurrect deletions.
 */
@Injectable()
export class LetterboxdImportSource extends MediaImportSource<ParsedImport> {
  readonly id = "letterboxd";
  protected override readonly manualSearchMediaType = MediaType.MOVIE;

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    matchResolver: MediaMatchResolver,
    reviews: ReviewService,
  ) {
    super(prisma, mediaItemService, matchResolver, reviews);
  }

  parseInput(input: string): ParsedImport {
    const entries = readZipEntriesByPath(
      Buffer.from(input, "base64"),
      isWanted,
    );
    const { movies, lists } = parseLetterboxdExport(entries);
    return { source: this.id, shows: [], movies, lists };
  }

  protected override acceptsMatch(match: ResolvedMatch): boolean {
    return (
      match.source === CatalogSource.TMDB && match.type === MediaType.MOVIE
    );
  }
}

/**
 * Which archive members are read. Exported for its own test: the exclusions
 * are decisions, not details — re-importing `deleted/` would resurrect entries
 * the user removed, and `likes/` is other members' content.
 */
export function isWanted(path: string): boolean {
  if (path.includes("deleted/") || path.includes("orphaned/")) return false;
  // Only the user's own lists; `likes/` holds other members' content.
  if (path.includes("likes/")) return false;
  if (path.includes("lists/") && path.endsWith(".csv")) return true;
  return WANTED_FILES.some(
    (file) => path === file || path.endsWith(`/${file}`),
  );
}
