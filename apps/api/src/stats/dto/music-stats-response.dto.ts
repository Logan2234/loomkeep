import type { MusicStatsDto } from "@loomkeep/shared";
import { LabelCountResponseDto } from "../../common/dto/label-count-response.dto";

export class MusicStatsResponseDto implements MusicStatsDto {
  listenDurationMin!: number;
  totalTracks!: number;
  distinctArtistsCount!: number;
  topArtists!: LabelCountResponseDto[];
  releaseTypeSplit!: LabelCountResponseDto[];
}
