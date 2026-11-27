import type { NotificationDto } from "@loomkeep/shared/contracts";

export class NotificationResponseDto implements NotificationDto {
  id!: string;
  type!: string;
  title!: string;
  body!: string | null;
  url!: string | null;
  data!: Record<string, unknown>;
  timestamp!: string;
  createdAt!: string;
  readAt!: string | null;
}
