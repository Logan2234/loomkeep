import type {
  CastDetailDto,
  CatalogSource,
  MediaExtrasDto,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";

export interface ProviderExternalId {
  source: MediaSource;
  externalId: string;
}

export interface ProviderEpisode {
  number: number;
  title: string | null;
  airDate: string | null;
}

export interface ProviderSeason {
  number: number;
  title: string | null;
  episodes: ProviderEpisode[];
}

/** Everything a provider knows about one media, in canonical form. */
export interface ProviderMediaDetails {
  summary: MediaSummaryDto;
  overview: string | null;
  backdropUrl: string | null;
  genres: string[];
  status: string | null;
  releaseDate: string | null;
  /** Average minutes per episode (series/anime) or the film's runtime; null if unknown. */
  runtimeMin: number | null;
  externalIds: ProviderExternalId[];
  seasons: ProviderSeason[];
}

export interface CatalogProvider {
  readonly source: CatalogSource;
  search(
    query: string,
    type?: MediaType,
    page?: number,
  ): Promise<MediaSummaryDto[]>;
  getDetails(sourceId: string, type: MediaType): Promise<ProviderMediaDetails>;
  /** Live, non-persisted extras: where to watch, cast, similar titles. */
  getExtras(sourceId: string, type: MediaType): Promise<MediaExtrasDto>;
  /**
   * Live detail of a cast entity (e.g. a TMDB person). Optional: sources with
   * no linkable cast entity (AniList) omit it, and their cast has null ids.
   */
  getPerson?(id: string): Promise<CastDetailDto>;
}
