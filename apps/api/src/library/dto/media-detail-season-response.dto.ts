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
  watchCount!: number;
  watches!: EpisodeWatchResponseDto[];
}

export class MediaDetailSeasonResponseDto implements MediaDetailSeasonDto {
  id!: string | null;
  number!: number;
  title!: string | null;
  episodes!: MediaDetailEpisodeResponseDto[];
}
