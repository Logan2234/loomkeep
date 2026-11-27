import type { EpisodeWatchDto } from "@loomkeep/shared/contracts";

export class EpisodeWatchResponseDto implements EpisodeWatchDto {
  id!: string;
  episodeId!: string;
  watchedAt!: string | null;
}
