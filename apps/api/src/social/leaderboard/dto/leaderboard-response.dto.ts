import type { LeaderboardDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { LeaderboardEntryResponseDto } from "./leaderboard-entry-response.dto";

export class LeaderboardResponseDto implements LeaderboardDto {
  @ApiProperty({ type: LeaderboardEntryResponseDto, isArray: true })
  entries!: LeaderboardEntryResponseDto[];

  @ApiProperty({ type: LeaderboardEntryResponseDto, nullable: true })
  viewerOutsideTop!: LeaderboardEntryResponseDto | null;
}
