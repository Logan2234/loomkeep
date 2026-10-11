import type { ApiV1NotificationsDto } from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ApiV1NotificationResponseDto } from "./api-v1-notification-response.dto";
export class ApiV1NotificationsResponseDto implements ApiV1NotificationsDto {
  /**
   * Notifications not read yet.
   * @example 3
   */
  unread!: number;

  /** The most recent notifications, newest first. */
  @ApiProperty({ type: ApiV1NotificationResponseDto, isArray: true })
  items!: ApiV1NotificationResponseDto[];
}
