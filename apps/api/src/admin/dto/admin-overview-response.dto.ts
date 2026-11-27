import type { AdminOverviewDto } from "@loomkeep/shared/contracts";

export class AdminOverviewResponseDto implements AdminOverviewDto {
  accounts!: number;
  newAccountsLast7Days!: number;
  connectedNow!: number;
  accountsWithPush!: number;
  pushDevices!: number;
  cachedItems!: number;
}
