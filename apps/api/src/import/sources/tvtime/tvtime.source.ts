import { ErrorCode, type TvTimeImportFilesDto } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { AppException } from "../../../common/app.exception";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type {
  ImportMovie,
  ImportShow,
  ParsedImport,
} from "../../media-import-model";
import { readZipEntries } from "../../zip";
import { MediaImportSource } from "../media/media-import.source";
import { MediaMatchResolver } from "../media/media-match-resolver";
import {
  parseTvTimeExport,
  type ParsedMovie,
  type ParsedShow,
} from "./parse-export";

/** Each import field → its file name in the TV Time GDPR export. */
const FILE_NAMES: Record<keyof TvTimeImportFilesDto, string> = {
  episodesCsv: "tracking-prod-records-v2.csv",
  showsCsv: "user_tv_show_data.csv",
  recordsCsv: "tracking-prod-records.csv",
  rewatchedCsv: "rewatched_episode.csv",
};

/**
 * TV Time GDPR export (`.zip` of CSVs), reconciled through TVDB ids. The
 * export is fully parsed synchronously in {@link parseInput}; the shared
 * resolve/plan/commit mechanics live in {@link MediaImportSource}.
 */
@Injectable()
export class TvTimeImportSource extends MediaImportSource<ParsedImport> {
  readonly id = "tvtime";

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    matchResolver: MediaMatchResolver,
    reviews: ReviewService,
  ) {
    super(prisma, mediaItemService, matchResolver, reviews);
  }

  parseInput(input: string): ParsedImport {
    const files = extractFiles(Buffer.from(input, "base64"));
    const { shows, movies } = parseTvTimeExport(files);
    return {
      source: this.id,
      shows: shows.map(toImportShow),
      movies: movies.map(toImportMovie),
    };
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
    watchedAt: movie.watchedAt,
    rewatchedAt: movie.rewatchedAt,
    externalIds: {},
  };
}

/**
 * Decode + validate the archive and extract the CSVs we need. Throws
 * {@link AppException} on a bad or incomplete archive. Movies are
 * optional: their file may be absent (then there are simply no movies).
 */
function extractFiles(input: Buffer): TvTimeImportFilesDto {
  if (input.length === 0) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ImportArchiveEmpty,
    );
  }

  let entries: Map<string, string>;

  try {
    entries = readZipEntries(input, new Set(Object.values(FILE_NAMES)));
  } catch (error) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ImportArchiveUnreadable,
      undefined,
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
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ImportArchiveMissingFiles,
      undefined,
      `Missing required file(s) in the archive: ${missing.join(", ")}`,
    );
  }

  return files;
}
