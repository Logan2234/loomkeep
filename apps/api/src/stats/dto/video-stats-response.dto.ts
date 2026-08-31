import type {
  VideoFilmExtremeDto,
  VideoStatsDto,
  VideoTypeSplitDto,
} from "@loomkeep/shared";

class VideoTypeSplitResponseDto implements VideoTypeSplitDto {
  type!: VideoTypeSplitDto["type"];
  count!: number;
  minutes!: number;
}

class VideoFilmExtremeResponseDto implements VideoFilmExtremeDto {
  title!: string;
  minutes!: number;
  href!: string;
}

class VideoGenreCountResponseDto {
  genre!: string;
  count!: number;
}

export class VideoStatsResponseDto implements VideoStatsDto {
  totalMinutes!: number;
  episodesWatched!: number;
  uniqueEpisodesWatched!: number;
  seasonsCompleted!: number;
  typeSplit!: VideoTypeSplitResponseDto[];
  avgEpisodeRuntimeMin!: number | null;
  longestFilm!: VideoFilmExtremeResponseDto | null;
  shortestFilm!: VideoFilmExtremeResponseDto | null;
  genres!: VideoGenreCountResponseDto[];
  pausedCount!: number;
  ghostCount!: number;
  longestBingeCount!: number;
  moviesRewatchedCount!: number;
}
