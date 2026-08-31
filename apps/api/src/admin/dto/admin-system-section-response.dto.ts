import type {
  AdminProviderCallsDto,
  AdminSystemSectionDto,
} from "@loomkeep/shared";

class AdminProviderCallsResponseDto implements AdminProviderCallsDto {
  provider!: string;
  calls!: number;
  dailyLimit!: number | null;
  percentUsed!: number | null;
}

class AdminBackupSummaryResponseDto {
  createdAt!: string;
  sizeBytes!: number;
}

class AdminOpsSignalsResponseDto {
  notificationsPending!: number;
  pushSubscriptions!: number;
  failedLogins24h!: number;
  lastBackup!: AdminBackupSummaryResponseDto | null;
}

export class AdminSystemSectionResponseDto implements AdminSystemSectionDto {
  generatedAt!: string;
  providerCalls!: AdminProviderCallsResponseDto[];
  ops!: AdminOpsSignalsResponseDto;
}
