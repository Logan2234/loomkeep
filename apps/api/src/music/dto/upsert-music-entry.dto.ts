import {
  ENTRY_NOTES_MAX_LENGTH,
  UpsertMusicEntryDto as UpsertMusicEntryContract,
} from "@loomkeep/shared/contracts";
import { MusicSource, MusicStatus } from "@loomkeep/shared/enums";
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
import { IsRatingStep } from "../../common/rating-step.validator";

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
  @IsRatingStep()
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(ENTRY_NOTES_MAX_LENGTH)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}
