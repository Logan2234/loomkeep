import type { LeaderboardEntryDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardEntryResponseDto implements LeaderboardEntryDto {
  id!: string;
  username!: string;
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  xp!: number;
  rank!: number;
  isViewer!: boolean;
}
