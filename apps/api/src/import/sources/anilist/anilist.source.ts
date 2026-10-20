import { CatalogSource, ErrorCode, MediaType } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { MediaItemService } from "../../../catalog/media-item.service";
import { AnilistProvider } from "../../../catalog/providers/anilist.provider";
import { AppException } from "../../../common/app.exception";
import { PrismaService } from "../../../prisma/prisma.service";
import { ReviewService } from "../../../reviews/review.service";
import type { ParsedImport } from "../../media-import-model";
import {
  MediaImportSource,
  type ResolvedMatch,
} from "../media/media-import.source";
import { AnilistMatchResolver } from "../myanimelist/anilist-match-resolver";
import { buildAnilistShows } from "./anilist.parser";

/** Parse model: the user name, filled in with the fetched list by {@link load}. */
interface AnilistParsed extends ParsedImport {
  userName: string;
}

// AniList user names: letters, digits, and a few separators.
const USER_NAME = /^[A-Za-z0-9_-]{2,40}$/;

/**
 * An AniList user's anime list, read from AniList's public API by user
 * name: no file to export, and no matching, since its ids are the
 * catalogue's own. A private list is refused with its own code.
 */
@Injectable()
export class AnilistImportSource extends MediaImportSource<AnilistParsed> {
  readonly id = "anilist";
  protected override readonly manualSearchMediaType = MediaType.ANIME;

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    // Every show carries its match: this one only serves a manual search.
    matchResolver: AnilistMatchResolver,
    reviews: ReviewService,
    private readonly anilist: AnilistProvider,
  ) {
    super(prisma, mediaItemService, matchResolver, reviews);
  }

  parseInput(input: string): AnilistParsed {
    const userName = input
      .trim()
      .replace(/^https?:\/\/anilist\.co\/user\//i, "")
      .replace(/\/.*$/, "");

    if (!USER_NAME.test(userName)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ImportAnilistUserNotFound,
      );
    }

    return { source: this.id, userName, shows: [], movies: [] };
  }

  protected override async load(parsed: AnilistParsed): Promise<void> {
    parsed.shows = buildAnilistShows(
      await this.anilist.getUserAnimeList(parsed.userName),
    );
  }

  protected override acceptsMatch(match: ResolvedMatch): boolean {
    return (
      match.source === CatalogSource.ANILIST && match.type === MediaType.ANIME
    );
  }
}
