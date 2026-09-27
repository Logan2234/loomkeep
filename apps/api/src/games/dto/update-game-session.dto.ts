import type { UpdateGameSessionDto as Contract } from "@loomkeep/shared";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateGameSessionDto implements Contract {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
