import type { AdminPushBroadcastResponseDto } from "@loomkeep/shared/contracts";

export class AdminPushBroadcastResultResponseDto implements AdminPushBroadcastResponseDto {
  accountCount!: number;
  deviceCount!: number;
  successCount!: number;
  failureCount!: number;
}
