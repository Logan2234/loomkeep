import type { ApiV1NotificationDto } from "@loomkeep/shared";

export class ApiV1NotificationResponseDto implements ApiV1NotificationDto {
  /**
   * The notification's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * What kind of notification it is (NEW_EPISODE, FOLLOW_REQUEST…).
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
   * Where it leads in the web app, if anywhere.
   * @example "https://loomkeep.app/app/media/series/95396"
   */
  url!: string | null;

  /**
   * The episode's air date for a new episode, else when it was created.
   * @example "2026-09-30T21:00:00.000Z"
   */
  date!: string;

  /**
   * When it was created.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;

  /**
   * When it was read, or null while unread.
   * @example "2026-10-01T08:12:00.000Z"
   */
  readAt!: string | null;
}
