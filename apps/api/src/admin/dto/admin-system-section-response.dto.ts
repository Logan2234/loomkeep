import type {
  AdminProviderCallsDto,
  AdminSelfHostedInstancesDto,
  AdminSelfHostedVersionDto,
  AdminSystemSectionDto,
} from "@loomkeep/shared/contracts";

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
  notificationsTotal!: number;
  pushSubscriptions!: number;
  failedLogins24h!: number;
  lastBackup!: AdminBackupSummaryResponseDto | null;
}

class AdminSelfHostedVersionResponseDto implements AdminSelfHostedVersionDto {
  version!: string;
  instances!: number;
}

class AdminSelfHostedInstancesResponseDto implements AdminSelfHostedInstancesDto {
  active30d!: number;
  versions!: AdminSelfHostedVersionResponseDto[];
}

export class AdminSystemSectionResponseDto implements AdminSystemSectionDto {
  generatedAt!: string;
  providerCalls!: AdminProviderCallsResponseDto[];
  ops!: AdminOpsSignalsResponseDto;
  selfHostedInstances!: AdminSelfHostedInstancesResponseDto | null;
}
