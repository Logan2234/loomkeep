import type { DataExportAccountRecord } from "@loomkeep/shared";

class DataExportAvatarResponseDto {
  /**
   * The image's format.
   * @example "image/webp"
   */
  mimeType!: string;

  /**
   * The image itself, base64-encoded.
   * @example "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA="
   */
  base64!: string;
}

export class DataExportAccountRecordResponseDto implements DataExportAccountRecord {
  /**
   * When the terms of service were last accepted.
   * @example "2026-03-14T09:26:53.000Z"
   */
  termsAcceptedAt!: string | null;

  /**
   * When the account holder certified being old enough to sign up.
   * @example "2026-03-14T09:26:53.000Z"
   */
  ageCertifiedAt!: string | null;

  /**
   * When the newsletter was opted into, if it was.
   * @example "2026-04-02T18:10:00.000Z"
   */
  newsletterOptInAt!: string | null;

  /**
   * Last activity on the account.
   * @example "2026-09-30T21:00:00.000Z"
   */
  lastActiveAt!: string | null;

  /**
   * End of a moderation suspension, if one is running.
   * @example "2026-10-10T00:00:00.000Z"
   */
  suspendedUntil!: string | null;

  /**
   * Achievement badges shown on the profile.
   * @example ["first_review"]
   */
  equippedBadgeKeys!: string[];

  /** The profile photo, when one was uploaded. */
  avatar!: DataExportAvatarResponseDto | null;
}
