import { ApiProperty } from "@nestjs/swagger";
import type { PublicStatsSummaryDto } from "../public-stats.types";

export class PublicStatsSummaryResponseDto implements PublicStatsSummaryDto {
  @ApiProperty({ enum: ["ok"] })
  status!: "ok";

  userCount!: number;
  openReports!: number;
  newUsers7d!: number;
  operational!: string;
  gitSha!: string;
  version!: string;
  latestVersion!: string;

  @ApiProperty({ enum: ["yes", "no", "unknown"] })
  updateAvailable!: "yes" | "no" | "unknown";
}
