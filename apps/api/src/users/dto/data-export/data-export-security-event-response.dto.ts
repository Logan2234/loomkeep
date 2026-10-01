import type {
  DataExportSecurityEvent,
  SecurityEventType,
} from "@loomkeep/shared";

export class DataExportSecurityEventResponseDto implements DataExportSecurityEvent {
  /**
   * What happened.
   * @example "NEW_DEVICE_LOGIN"
   */
  type!: SecurityEventType;

  /**
   * The email or username involved.
   * @example "alice"
   */
  identifier!: string;

  /**
   * Extra detail, such as a device or key name.
   * @example "Firefox on Windows"
   */
  detail!: string | null;

  /**
   * The browser or tool behind it.
   * @example "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
   */
  userAgent!: string | null;

  /**
   * The address it came from.
   * @example "203.0.113.7"
   */
  ip!: string | null;

  /**
   * When it happened.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}
