import type {
  CastDetailDto,
  CatalogSource,
  MediaExtrasDto,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import type { ProviderExternalId as GenericProviderExternalId } from "../../common/provider-external-id";

export type ProviderExternalId = GenericProviderExternalId<MediaSource>;

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
  /** `lang` (ISO 639-1, e.g. "fr"): the signed-in user's locale, when known. */
  search(
    query: string,
    type?: MediaType,
    page?: number,
    lang?: string,
  ): Promise<MediaSummaryDto[]>;
  /** `lang` (ISO 639-1, e.g. "fr"): the signed-in user's locale, when known. */
  getDetails(
    sourceId: string,
    type: MediaType,
    lang?: string,
  ): Promise<ProviderMediaDetails>;
  /**
   * Live, non-persisted extras: where to watch, cast, similar titles.
   * `lang` (ISO 639-1, e.g. "fr"): the signed-in user's locale, when known.
   */
  getExtras(
    sourceId: string,
    type: MediaType,
    lang?: string,
  ): Promise<MediaExtrasDto>;
  /**
   * Live detail of a cast entity (a TMDB person, or an AniList staff/voice
   * actor). Optional: cast entries with no linkable entity (e.g. an AniList
   * character with no credited voice actor) have a null id instead.
   */
  getPerson?(id: string): Promise<CastDetailDto>;
}
