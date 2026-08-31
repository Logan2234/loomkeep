import type { ProfileActivityStatsDto } from "@loomkeep/shared";
import { LabelCountResponseDto } from "../../common/dto/label-count-response.dto";

export class ProfileActivityStatsResponseDto implements ProfileActivityStatsDto {
  visible!: boolean;
  streakDays!: number;
  firstActivityAt!: string | null;
  lastActivityAt!: string | null;
  totalMinutes!: number;
  mostActiveYear!: number | null;
  topGenres!: LabelCountResponseDto[];
  heatmap!: { date: string; count: number }[];
}
