import type { CreateGameSessionDto as Contract } from "@loomkeep/shared";
import { IsDateString, IsInt, Max, Min } from "class-validator";

export class CreateGameSessionDto implements Contract {
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @IsDateString()
  occurredAt!: string;
}
