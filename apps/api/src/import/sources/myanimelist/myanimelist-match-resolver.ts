import type { ImportMatch } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import type { ImportMovie, ImportShow } from "../../media-import-model";
import {
  type MediaImportMatchResolver,
  toMatch,
} from "../media/media-match-resolver";

/**
 * Resolves MAL's anime by title on TMDB: only an anime series whose title or
 * original title is exactly MAL's, anything fuzzier is left for the review.
 * A MAL entry is one cour while TMDB files the whole show, so a sequel's
 * title rarely matches and goes to the review too.
 */
@Injectable()
export class MyAnimeListMatchResolver implements MediaImportMatchResolver {
  constructor(private readonly tmdb: TmdbProvider) {}

  async resolveShow(show: ImportShow): Promise<ImportMatch | null> {
    try {
      const norm = (s: string) => s.toLowerCase().trim();
      const title = norm(show.title);
      const match = (await this.tmdb.search(show.title, "ANIME")).find(
        (s) =>
          s.type === "ANIME" &&
          (norm(s.title) === title ||
            (s.originalTitle !== null && norm(s.originalTitle) === title)),
      );
      return match ? toMatch(match) : null;
    } catch {
      return null;
    }
  }

  async resolveMovie(_movie: ImportMovie): Promise<ImportMatch | null> {
    return null;
  }
}
