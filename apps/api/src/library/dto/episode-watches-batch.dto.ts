import type {
  EpisodeWatchBatchAction,
  EpisodeWatchBatchResultDto,
  EpisodeWatchRestoreDto,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class EpisodeWatchesBatchDto {
  @IsIn(["watch", "rewatch", "unwatch"])
  action!: EpisodeWatchBatchAction;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  episodeIds!: string[];
}

export class EpisodeWatchRestoreBodyDto implements EpisodeWatchRestoreDto {
  @IsString()
  episodeId!: string;

  /** Null for a viewing with no known date, as imports leave them. */
  @IsOptional()
  @IsDateString()
  watchedAt!: string | null;
}

export class UndoEpisodeWatchesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deleteWatchIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EpisodeWatchRestoreBodyDto)
  restore?: EpisodeWatchRestoreBodyDto[];
}

class CreatedEpisodeWatchResponseDto {
  id!: string;
  episodeId!: string;
}

export class EpisodeWatchBatchResponseDto implements EpisodeWatchBatchResultDto {
  created!: CreatedEpisodeWatchResponseDto[];
  removed!: EpisodeWatchRestoreBodyDto[];
}
