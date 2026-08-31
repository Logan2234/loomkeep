import type {
  AdminPushSendOutcomeDto,
  AdminPushSendResponseDto,
} from "@loomkeep/shared";

class AdminPushSendOutcomeResponseDto implements AdminPushSendOutcomeDto {
  userAgent!: string | null;
  ok!: boolean;
  error?: string;
}

export class AdminPushSendResultResponseDto implements AdminPushSendResponseDto {
  subscriptionCount!: number;
  results!: AdminPushSendOutcomeResponseDto[];
}
