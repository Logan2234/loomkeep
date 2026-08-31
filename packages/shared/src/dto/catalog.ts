import type { CatalogSource, MediaType } from "../enums";
import type { EpisodeWatchDto, LibraryEntryDto } from "./library";
import type { PagedResult } from "./pagination";

/** A media as returned by a live catalogue search (not persisted). */
export interface MediaSummaryDto {
  source: CatalogSource;
  sourceId: string;
  type: MediaType;
  title: string;
  /**
   * Original-language title, when the source provides one (TMDB
   * `original_title`/`original_name`). Lets title matching succeed against the
   * original title even when `title` is a localized (e.g. en-US) variant.
   */
  originalTitle?: string | null;
  year: number | null;
  posterUrl: string | null;
  /** 18+ title (TMDB `adult` movies, AniList hentai). Restricted per-account. */
  isAdult: boolean;
}

export type SearchResponseDto = PagedResult<MediaSummaryDto>;

/** A streaming platform where a title is available (from TMDB / JustWatch). */
export interface WatchProviderDto {
  name: string;
  logoUrl: string | null;
}

/** Where to watch, split by offer type, for one region. */
export interface WatchProvidersDto {
  flatrate: WatchProviderDto[];
  rent: WatchProviderDto[];
  buy: WatchProviderDto[];
  /** JustWatch deep link for the region, if any. */
  link: string | null;
}

export interface CastMemberDto {
  /**
   * Source id of the cast entity (TMDB person id), used to open its detail.
   * null when the source exposes no linkable entity (e.g. AniList characters),
   * in which case the member is not clickable.
   */
  id: string | null;
  name: string;
  /** Character/role, when known. */
  role: string | null;
  photoUrl: string | null;
  /**
   * The character's own photo, when `photoUrl`/`name` refer to the voice
   * actor instead (AniList) — lets the cast card show both side by side.
   * Null when there's no separate character image (TMDB, or an AniList
   * entry with no voice actor credited, where `photoUrl` already is the
   * character's).
   */
  characterPhotoUrl: string | null;
}

/**
 * Detail of a cast entity (a TMDB person today), fetched live for the cast
 * modal on the media page. Kept generic so other sources could fill it later.
 */
export interface CastDetailDto {
  name: string;
  photoUrl: string | null;
  /** One-line context, e.g. "1985 – Tokyo, Japan" for a person. */
  subtitle: string | null;
  /** Biography; may be long or empty. */
  description: string | null;
  /** Notable works, linkable to their own media page. */
  knownFor: MediaSummaryDto[];
  /** IMDb person id (`nm…`), for an external link; null when unknown. */
  imdbId: string | null;
  /** Wikidata entity id (`Q…`), for an external link; null when unknown. */
  wikidataId: string | null;
  /** Personal/official homepage, when the source exposes one. */
  homepage: string | null;
}

/** One community/critic score, kept as a display string (e.g. "8.5", "91%"). */
export interface RatingDto {
  /** Short label: "TMDB", "AniList", "IMDb", "RT", "Metacritic". */
  source: string;
  score: string;
  /** External link to the score's source, when one is known (e.g. IMDb). */
  url?: string;
}

/** An official/external link (streaming, official site…), from AniList. */
export interface ExternalLinkDto {
  /** Site name, e.g. "Crunchyroll", "Official Site". */
  name: string;
  url: string;
}

/** Rich, non-persisted extras for the media detail page (fetched live). */
export interface MediaExtrasDto {
  watchProviders: WatchProvidersDto;
  cast: CastMemberDto[];
  /** Similar / recommended titles, linkable to their own media page. */
  similar: MediaSummaryDto[];
  /** Community/critic scores (TMDB/AniList always; IMDb/RT/Metacritic via OMDb). */
  ratings: RatingDto[];
  /**
   * Backdrop gallery for the lightbox carousel (TMDB only — AniList exposes no
   * screenshot gallery beyond the poster/banner already shown on the page).
   */
  images: string[];
  /** Marketing tagline, when the source has one (TMDB only). */
  tagline: string | null;
  /**
   * Director(s) for a movie, creator(s)/showrunner(s) for a series (TMDB), or
   * the credited director(s) (AniList staff).
   */
  directors: string[];
  /** YouTube video id for a trailer, when the source lists one. */
  trailerVideoId: string | null;
  /**
   * Official age certification (e.g. "12", "PG-13"), when known — distinct
   * from `isAdult`, which only flags pornographic content (TMDB only; AniList
   * has no equivalent).
   */
  contentRating: string | null;
  /** Animation studio(s) credited as main studio (AniList only). */
  studios: string[];
  /** Release format, e.g. "TV", "MOVIE", "OVA", "ONA", "SPECIAL" (AniList only). */
  format: string | null;
  /** Airing season — "WINTER" | "SPRING" | "SUMMER" | "FALL" (AniList only). */
  season: string | null;
  /** Prequels/sequels and other related anime entries (AniList only). */
  relations: MediaSummaryDto[];
  /** Official/external links (AniList only). */
  externalLinks: ExternalLinkDto[];
  /** Descriptive tags, spoiler tags excluded (AniList only). */
  tags: string[];
}

interface EpisodeDto {
  /** Internal ID, only present once the media is persisted. */
  id: string | null;
  number: number;
  title: string | null;
  airDate: string | null;
}

interface SeasonDto {
  id: string | null;
  number: number;
  title: string | null;
  episodes: EpisodeDto[];
}

/** Full media details, fetched live from the source (seasons included for series/anime). */
export interface MediaDetailsDto extends MediaSummaryDto {
  overview: string | null;
  backdropUrl: string | null;
  genres: string[];
  /** In-production / ended / releasing… free-form, source-dependent. */
  status: string | null;
  seasons: SeasonDto[];
}

/** One episode on the unified media page, carrying the user's watch history. */
export interface MediaDetailEpisodeDto {
  /** null until the media is persisted (i.e. not yet in anyone's library). */
  id: string | null;
  number: number;
  title: string | null;
  airDate: string | null;
  watchCount: number;
  /** The current user's viewings of this episode (date + rating), most recent first. */
  watches: EpisodeWatchDto[];
}

export interface MediaDetailSeasonDto {
  id: string | null;
  number: number;
  title: string | null;
  episodes: MediaDetailEpisodeDto[];
}

/**
 * Everything the unified media page (`/media/{type}/{id}`) needs in one call:
 * catalogue metadata (cached if persisted, else fetched live) + the current
 * user's library state. `entry` is null when the media is not in the library.
 */
export interface MediaDetailDto extends Omit<
  MediaDetailsDto,
  "seasons" | "status" | "originalTitle"
> {
  /** Always present here (may be null), unlike the optional field on MediaSummaryDto. */
  originalTitle: string | null;
  /** Raw airing status from the source (e.g. "Ended", "RELEASING"). */
  airingStatus: string | null;
  /** Normalised: the show has finished airing (no more episodes coming). */
  airingFinished: boolean;
  seasons: MediaDetailSeasonDto[];
  entry: LibraryEntryDto | null;
}
