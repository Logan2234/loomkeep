import type {
  AdminSocialActivityTrendDto,
  TrendPeriod,
} from "@loomkeep/shared";
import { TrendPointResponseDto } from "./trend-point-response.dto";

export class AdminSocialActivityTrendResponseDto implements AdminSocialActivityTrendDto {
  period!: TrendPeriod;
  points!: TrendPointResponseDto[];
  total!: number;
}
