import {
  MusicSource,
  MusicStatus,
  UpsertMusicEntryDto as UpsertMusicEntryContract,
} from "@loomkeep/shared";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpsertMusicEntryDto implements UpsertMusicEntryContract {
  @IsIn(Object.values(MusicSource))
  source!: MusicSource;

  @IsString()
  sourceId!: string;

  @IsOptional()
  @IsIn(Object.values(MusicStatus))
  status?: MusicStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}
