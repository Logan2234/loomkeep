import type { AdminOverviewDto } from "@loomkeep/shared";

export class AdminOverviewResponseDto implements AdminOverviewDto {
  accounts!: number;
  newAccountsThisWeek!: number;
  accountsWithPush!: number;
  pushDevices!: number;
  cachedItems!: number;
}
