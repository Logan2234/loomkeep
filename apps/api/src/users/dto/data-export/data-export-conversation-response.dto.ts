import type {
  DataExportConversation,
  DataExportMessage,
} from "@loomkeep/shared";

export class DataExportMessageResponseDto implements DataExportMessage {
  /**
   * Written by this account rather than by the other member.
   * @example true
   */
  mine!: boolean;

  /**
   * The text, as written (restricted markdown). Null once deleted.
   * @example "Tu en es où dans **Severance** ?"
   */
  text!: string | null;

  /**
   * Sent masked as a spoiler.
   * @example false
   */
  spoiler!: boolean;

  /**
   * Edited after being sent.
   * @example false
   */
  edited!: boolean;

  /**
   * When it was deleted, by its author or by moderation.
   * @example null
   */
  deletedAt!: string | null;

  /**
   * When it was sent.
   * @example "2026-10-06T21:30:00.000Z"
   */
  createdAt!: string;
}

export class DataExportConversationResponseDto implements DataExportConversation {
  /**
   * The other member's username; null once their account is deleted.
   * @example "lea"
   */
  peerUsername!: string | null;

  /**
   * Muted by this account.
   * @example false
   */
  muted!: boolean;

  /** Every message, sent and received, oldest first. */
  messages!: DataExportMessageResponseDto[];
}
