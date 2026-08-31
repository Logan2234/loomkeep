import type { AdminPushBroadcastResponseDto } from "@loomkeep/shared";

export class AdminPushBroadcastResultResponseDto implements AdminPushBroadcastResponseDto {
  accountCount!: number;
  deviceCount!: number;
  successCount!: number;
  failureCount!: number;
}
