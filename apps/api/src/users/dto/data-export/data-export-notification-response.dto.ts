import type { DataExportNotification } from "@loomkeep/shared";

export class DataExportNotificationResponseDto implements DataExportNotification {
  /**
   * What kind of notification it is.
   * @example "NEW_EPISODE"
   */
  type!: string;

  /**
   * Its title, as stored.
   * @example "Severance"
   */
  title!: string;

  /**
   * Its text, if any.
   * @example "S02E08 is out"
   */
  body!: string | null;

  /**
   * Where it leads in the web app.
   * @example "/app/media/series/95396"
   */
  url!: string | null;

  /** Extra fields of that kind of notification. */
  data!: Record<string, unknown>;

  /**
   * When it was created.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
