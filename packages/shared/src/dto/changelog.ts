/** One release note entry — user-facing, distinct from the technical CHANGELOG.md. */
export interface ChangelogEntryDto {
  id: string;
  version: string;
  title: string;
  highlights: string[];
  publishedAt: string;
  /** Null until an admin explicitly sends the newsletter for this entry — resendable. */
  emailSentAt: string | null;
}

export interface CreateChangelogEntryRequestDto {
  version: string;
  title: string;
  highlights: string[];
}

export interface UpdateChangelogEntryRequestDto {
  version: string;
  title: string;
  highlights: string[];
}

/** Result of triggering the newsletter for one entry. */
export interface SendChangelogNewsletterResponseDto {
  /** How many opted-in accounts the email was sent to. */
  recipientCount: number;
  emailSentAt: string;
}
