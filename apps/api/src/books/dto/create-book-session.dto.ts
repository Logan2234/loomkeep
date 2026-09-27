import type { CreateBookSessionDto as Contract } from "@loomkeep/shared";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateBookSessionDto implements Contract {
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  pagesRead?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  startPage?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  endPage?: number;
}
