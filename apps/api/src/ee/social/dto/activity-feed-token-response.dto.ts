import type { ActivityFeedTokenDto } from "@loomkeep/shared/contracts";

export class ActivityFeedTokenResponseDto implements ActivityFeedTokenDto {
  token!: string;
}
