import type { NotificationCountsDto } from "@loomkeep/shared/contracts";

export class NotificationCountsResponseDto implements NotificationCountsDto {
  unread!: number;
  unseen!: number;
}
