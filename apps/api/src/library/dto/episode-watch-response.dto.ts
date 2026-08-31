import type { EpisodeWatchDto } from "@loomkeep/shared";

export class EpisodeWatchResponseDto implements EpisodeWatchDto {
  id!: string;
  episodeId!: string;
  watchedAt!: string;
}
