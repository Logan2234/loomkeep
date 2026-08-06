import {
  GameSource,
  GameStatus,
  UpsertGameEntryDto as UpsertGameEntryContract,
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

export class UpsertGameEntryDto implements UpsertGameEntryContract {
  @IsIn(Object.values(GameSource))
  source!: GameSource;

  @IsString()
  sourceId!: string;

  @IsOptional()
  @IsIn(Object.values(GameStatus))
  status?: GameStatus;

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
