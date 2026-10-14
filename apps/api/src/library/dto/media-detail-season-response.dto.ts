import type {
  MediaDetailEpisodeDto,
  MediaDetailSeasonDto,
} from "@loomkeep/shared";
import { EpisodeWatchResponseDto } from "./episode-watch-response.dto";

export class MediaDetailEpisodeResponseDto implements MediaDetailEpisodeDto {
  id!: string | null;
  number!: number;
  title!: string | null;
  airDate!: string | null;
  runtimeMin!: number | null;
  overview!: string | null;
  stillUrl!: string | null;
  voteAverage!: number | null;
  voteCount!: number | null;
  streamingUrl!: string | null;
  streamingSite!: string | null;
  reviewCount!: number | null;
  reviewAverage!: number | null;
  myRating!: number | null;
  watchCount!: number;
  watches!: EpisodeWatchResponseDto[];
}

export class MediaDetailSeasonResponseDto implements MediaDetailSeasonDto {
  id!: string | null;
  number!: number;
  title!: string | null;
  overview!: string | null;
  posterUrl!: string | null;
  airDate!: string | null;
  voteAverage!: number | null;
  reviewCount!: number | null;
  reviewAverage!: number | null;
  myRating!: number | null;
  episodes!: MediaDetailEpisodeResponseDto[];
}
