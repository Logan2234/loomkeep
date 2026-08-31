import type { EpisodeWithWatchesDto } from "@loomkeep/shared";

export class EpisodeWithWatchesResponseDto implements EpisodeWithWatchesDto {
  id!: string;
  number!: number;
  title!: string | null;
  airDate!: string | null;
  watchCount!: number;
}
