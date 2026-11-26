import {
  ModerationLegalBasis,
  ModerationMeasure,
  type Locale,
} from "@loomkeep/shared";

/** A provider reaching one of its daily-quota alert thresholds. */
export interface QuotaAlert {
  /** Display name, e.g. "OMDb". */
  provider: string;
  count: number;
  limit: number;
  /** Share of the quota reached: 0.8 or 1. */
  threshold: number;
}

/** A scheduled job that started failing (`error` set) or succeeded again (`error: null`). */
export interface ImportAlert {
  /** Display name of the import source ("Letterboxd"). */
  source: string;
  /** First line of the error message. */
  error: string;
}

export interface JobAlert {
  jobKey: string;
  /** First line of the error message; null once the job has recovered. */
  error: string | null;
}

export interface MailRecipient {
  email: string;
  locale: string;
}

export interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Overrides the default no-reply `from` for replies — see sendModerationDecision. */
  replyTo?: string;
  headers?: Record<string, string>;
}

/** What a template renders: everything a send needs but the recipient. */
export type TemplateBody = Omit<SendArgs, "to" | "replyTo">;

/** One work in the monthly paused-works reminder. */
export interface PausedReminderItem {
  title: string;
  /** App path of the work's page. */
  url: string;
  /** Series and anime: episodes still to watch. */
  episodesLeft: number | null;
  /** Books: pages still to read. */
  pagesLeft: number | null;
  /** Days since the last episode, session or reading page. */
  pausedDays: number;
  /** Series and anime: episodes aired since the last one watched. */
  releasedSince: number;
}

/** One DSA art. 17 notice: every measure a single moderation decision applied. */
export interface ModerationDecisionMail {
  measures: ModerationMeasure[];
  /** ACCOUNT_SUSPENDED only: when the account comes back. */
  suspendedUntil?: Date | null;
  reasonText: string;
  legalBasis: ModerationLegalBasis;
  tosClause: string;
  /** One per measure, in the same order. */
  decisionIds: string[];
  decidedAt: Date;
}

/** One editable sample-data field for a gallery template (e.g. the recipient's display name). */
export interface MailTemplateField {
  key: string;
  label: string;
  default: string;
  /** Renders as a `<textarea>` in the admin gallery instead of a single-line input. */
  multiline?: boolean;
}

export interface MailTemplateInfo {
  key: string;
  label: string;
  fields: MailTemplateField[];
}

/** One line of the episode digest email. */
export interface DigestMailItem {
  title: string;
  body: string;
  url: string;
  seasonFinale?: boolean;
}

/** One template of the admin preview/test-send gallery (see mail-gallery.ts). */
export interface GalleryTemplate {
  label: string;
  fields: MailTemplateField[];
  build: (locale: Locale, values: Record<string, string>) => TemplateBody;
}
