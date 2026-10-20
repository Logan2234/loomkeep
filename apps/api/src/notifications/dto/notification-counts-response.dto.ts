import type { NotificationCountsDto } from "@loomkeep/shared";

export class NotificationCountsResponseDto implements NotificationCountsDto {
  unread!: number;
  unseen!: number;
}
