import type {
  CatalogSource,
  MediaDetailDto,
  MediaType,
} from "@loomkeep/shared";
import { LibraryEntryResponseDto } from "./library-entry-response.dto";
import { MediaDetailSeasonResponseDto } from "./media-detail-season-response.dto";
import { MovieReleaseResponseDto } from "./movie-release-response.dto";

export class MediaDetailResponseDto implements MediaDetailDto {
  source!: CatalogSource;
  sourceId!: string;
  type!: MediaType;
  title!: string;
  originalTitle!: string | null;
  year!: number | null;
  posterUrl!: string | null;
  isAdult!: boolean;
  overview!: string | null;
  backdropUrl!: string | null;
  genres!: string[];
  airingStatus!: string | null;
  releaseDate!: string | null;
  movieRelease!: MovieReleaseResponseDto | null;
  airingFinished!: boolean;
  runtimeMin!: number | null;
  seasons!: MediaDetailSeasonResponseDto[];
  commentTargetId!: string | null;
  entry!: LibraryEntryResponseDto | null;
}
