import type { DataExportNotification } from "@loomkeep/shared";

export class DataExportNotificationResponseDto implements DataExportNotification {
  type!: string;
  title!: string;
  body!: string | null;
  url!: string | null;
  data!: Record<string, unknown>;
  createdAt!: string;
}
