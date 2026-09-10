import { CatalogSource, MediaType } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type { ParsedImport } from "../../media-import-model";
import {
  MediaImportSource,
  type ResolvedMatch,
} from "../media/media-import.source";
import { AnilistMatchResolver } from "./anilist-match-resolver";
import { parseMyAnimeListXml } from "./parse-myanimelist-xml";

/** MyAnimeList's anime XML export, reconciled exclusively through AniList. */
@Injectable()
export class MyAnimeListImportSource extends MediaImportSource<ParsedImport> {
  readonly id = "myanimelist";
  protected override readonly manualSearchMediaType = MediaType.ANIME;

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    matchResolver: AnilistMatchResolver,
    reviews: ReviewService,
  ) {
    super(prisma, mediaItemService, matchResolver, reviews);
  }

  parseInput(input: string): ParsedImport {
    return parseMyAnimeListXml(input);
  }

  protected override acceptsMatch(match: ResolvedMatch): boolean {
    return (
      match.source === CatalogSource.ANILIST && match.type === MediaType.ANIME
    );
  }
}
