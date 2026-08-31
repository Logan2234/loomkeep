import type { AdminPushSendResponseDto } from "@loomkeep/shared";

class AdminPushSendOutcomeResponseDto {
  userAgent!: string | null;
  ok!: boolean;
  error?: string;
}

export class AdminPushSendResultResponseDto implements AdminPushSendResponseDto {
  subscriptionCount!: number;
  results!: AdminPushSendOutcomeResponseDto[];
}
