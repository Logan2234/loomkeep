import type { UpsertReadingGoalDto as UpsertReadingGoalContract } from "@loomkeep/shared";
import { READING_GOAL_LIMITS } from "@loomkeep/shared";
import { IsInt, Max, Min } from "class-validator";

export class UpsertReadingGoalDto implements UpsertReadingGoalContract {
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @IsInt()
  @Min(READING_GOAL_LIMITS.min)
  @Max(READING_GOAL_LIMITS.max)
  target!: number;
}
