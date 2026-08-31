import type { NotificationFeedDto } from "@loomkeep/shared";
import { NotificationResponseDto } from "./notification-response.dto";

export class NotificationFeedResponseDto implements NotificationFeedDto {
  notifications!: NotificationResponseDto[];
  unread!: number;
}
