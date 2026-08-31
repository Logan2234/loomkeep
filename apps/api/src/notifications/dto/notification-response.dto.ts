import type { NotificationDto } from "@loomkeep/shared";

export class NotificationResponseDto implements NotificationDto {
  id!: string;
  type!: string;
  title!: string;
  body!: string | null;
  url!: string | null;
  data!: Record<string, unknown>;
  timestamp!: string;
  createdAt!: string;
}
