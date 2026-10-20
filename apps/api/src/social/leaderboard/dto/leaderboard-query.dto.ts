import {
  type LeaderboardPeriod,
  type LeaderboardScope,
  LEADERBOARD_PERIODS,
  LEADERBOARD_SCOPES,
} from "@loomkeep/shared";
import { IsIn, IsOptional } from "class-validator";

export class LeaderboardQueryDto {
  @IsOptional()
  @IsIn(LEADERBOARD_SCOPES)
  scope?: LeaderboardScope;

  @IsOptional()
  @IsIn(LEADERBOARD_PERIODS)
  period?: LeaderboardPeriod;
}
