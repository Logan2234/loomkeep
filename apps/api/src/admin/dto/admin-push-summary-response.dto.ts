import type {
  AdminPushSummaryDto,
  AdminPushUserAgentStatDto,
} from "@loomkeep/shared/contracts";

class AdminPushUserAgentStatResponseDto implements AdminPushUserAgentStatDto {
  label!: string;
  count!: number;
}

export class AdminPushSummaryResponseDto implements AdminPushSummaryDto {
  subscriptions!: number;
  accounts!: number;
  byUserAgent!: AdminPushUserAgentStatResponseDto[];
}
