import {
  CatalogSource,
  type ImportPlan,
  type ImportReport,
  MediaType,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type { CommitDecisions, ProgressReporter } from "../../import-source";
import type { ParsedImport } from "../../media-import-model";
import {
  MediaImportSource,
  type ResolvedMatch,
} from "../media/media-import.source";
import { MyAnimeListMatchResolver } from "./myanimelist-match-resolver";
import { parseMyAnimeListXml } from "./myanimelist.parser";

/** MyAnimeList's anime XML export, matched by title against TMDB's anime. */
@Injectable()
export class MyAnimeListImportSource extends MediaImportSource<ParsedImport> {
  readonly id = "myanimelist";
  protected override readonly manualSearchMediaType = MediaType.ANIME;

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    matchResolver: MyAnimeListMatchResolver,
    reviews: ReviewService,
  ) {
    super(prisma, mediaItemService, matchResolver, reviews);
  }

  parseInput(input: string): ParsedImport {
    return parseMyAnimeListXml(input);
  }

  /**
   * A MAL entry matched by hand is most often one season of the TMDB show,
   * and its watched count can't say which episodes it means: it comes in
   * with its status alone, the episodes left for the user to tick.
   */
  override commit(
    userId: string,
    parsed: ParsedImport,
    plan: ImportPlan,
    decisions: CommitDecisions,
    progress: ProgressReporter,
  ): Promise<ImportReport> {
    const shows = parsed.shows.map((show) =>
      decisions.overrides.has(`anilist:${show.externalIds.anilist}`)
        ? { ...show, episodes: [] }
        : show,
    );
    return super.commit(
      userId,
      { ...parsed, shows },
      plan,
      decisions,
      progress,
    );
  }

  protected override acceptsMatch(match: ResolvedMatch): boolean {
    return (
      match.source === CatalogSource.TMDB && match.type === MediaType.ANIME
    );
  }
}
