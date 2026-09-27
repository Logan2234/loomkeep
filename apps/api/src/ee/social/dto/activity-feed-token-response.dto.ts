import type { ActivityFeedTokenDto } from "@loomkeep/shared";

export class ActivityFeedTokenResponseDto implements ActivityFeedTokenDto {
  token!: string;
}
