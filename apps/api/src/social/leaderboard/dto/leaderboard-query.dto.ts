import type { LeaderboardPeriod, LeaderboardScope } from "@loomkeep/shared";
import { IsIn, IsOptional } from "class-validator";

export class LeaderboardQueryDto {
  @IsOptional()
  @IsIn(["global", "friends"])
  scope?: LeaderboardScope;

  @IsOptional()
  @IsIn(["month", "year"])
  period?: LeaderboardPeriod;
}
