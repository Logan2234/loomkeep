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
  /**
   * A calendar date ("2024-03-08") from TMDB, or a full ISO timestamp when
   * the source knows the exact broadcast time (AniList's airing schedule).
   */
  airDate: string | null;
  runtimeMin: number | null;
  overview: string | null;
  stillUrl: string | null;
  /** The source's own community score (TMDB, /10) and its vote count. */
  voteAverage: number | null;
  voteCount: number | null;
  /** TMDB's "standard" / "mid_season" / "finale"; null elsewhere. */
  episodeType: string | null;
  /** Where to stream this episode (AniList's Crunchyroll links). */
  streamingUrl: string | null;
  streamingSite: string | null;
}

export interface ProviderSeason {
  number: number;
  title: string | null;
  overview: string | null;
  posterUrl: string | null;
  /** First broadcast of the season ("2024-03-08"). */
  airDate: string | null;
  /** The source's own average score (TMDB, /10). */
  voteAverage: number | null;
  episodes: ProviderEpisode[];
}

/** Everything a provider knows about one media, in canonical form. */
export interface ProviderMediaDetails {
  summary: MediaSummaryDto;
  overview: string | null;
  backdropUrl: string | null;
  genres: string[];
  status: string | null;
  /** AniList release format ("TV", "MOVIE", "OVA"…); null for TMDB. */
  format: string | null;
  releaseDate: string | null;
  movieReleaseDates?: import("@loomkeep/shared").MovieReleaseDate[];
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
   * `watchRegion` (ISO 3166-1, e.g. "FR"): the country of the offers.
   */
  getExtras(
    sourceId: string,
    type: MediaType,
    lang: string | undefined,
    watchRegion: string,
  ): Promise<MediaExtrasDto>;
  /**
   * Live detail of a cast entity (a TMDB person, or an AniList staff/voice
   * actor). Optional: cast entries with no linkable entity (e.g. an AniList
   * character with no credited voice actor) have a null id instead.
   */
  getPerson?(id: string): Promise<CastDetailDto>;
}
