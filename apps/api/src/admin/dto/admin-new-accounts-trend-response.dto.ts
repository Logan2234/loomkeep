import type { AdminNewAccountsTrendDto, TrendPeriod } from "@loomkeep/shared";
import { TrendPointResponseDto } from "./trend-point-response.dto";

export class AdminNewAccountsTrendResponseDto implements AdminNewAccountsTrendDto {
  period!: TrendPeriod;
  points!: TrendPointResponseDto[];
  totalAccounts!: number;
  delta!: number;
}
