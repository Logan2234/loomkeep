import type { ImportMatch, MediaSummaryDto } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { AnilistProvider } from "../../../catalog/providers/anilist.provider";
import type { ImportMovie, ImportShow } from "../../media-import-model";
import type { MediaImportMatchResolver } from "../media/media-match-resolver";

/** Resolves MAL's anime ids exclusively through AniList's `idMal` field. */
@Injectable()
export class AnilistMatchResolver implements MediaImportMatchResolver {
  constructor(private readonly anilist: AnilistProvider) {}

  async resolveShow(show: ImportShow): Promise<ImportMatch | null> {
    const malId = show.externalIds.anilist;
    if (!malId) return null;

    try {
      const summary = await this.anilist.getSummaryByMalId(malId);
      return summary ? toMatch(summary) : null;
    } catch {
      return null;
    }
  }

  async resolveMovie(_movie: ImportMovie): Promise<ImportMatch | null> {
    return null;
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
