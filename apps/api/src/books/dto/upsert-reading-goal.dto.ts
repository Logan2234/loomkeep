import type { UpsertReadingGoalDto as UpsertReadingGoalContract } from "@loomkeep/shared";
import { IsInt, Max, Min } from "class-validator";

export class UpsertReadingGoalDto implements UpsertReadingGoalContract {
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  target!: number;
}
