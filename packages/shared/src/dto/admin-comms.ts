import type { Locale } from "../locale";

export interface MailTemplateFieldDto {
  key: string;
  label: string;
  default: string;
  /** Renders as a `<textarea>` in the admin gallery instead of a single-line input. */
  multiline?: boolean;
}

export interface MailTemplateInfoDto {
  key: string;
  label: string;
  fields: MailTemplateFieldDto[];
}

export interface MailTemplateListResponseDto {
  templates: MailTemplateInfoDto[];
  /** Whether SMTP is configured — test-send is disabled otherwise. */
  smtpConfigured: boolean;
}

/** Rendered preview of one template (with sample data, possibly overridden), never sent. */
export interface MailTemplatePreviewDto {
  subject: string;
  html: string;
  text: string;
}

export interface SendTestEmailRequestDto {
  to: string;
  locale: Locale;
  /** Overrides for the template's editable sample fields, by field key. */
  values?: Record<string, string>;
}

/** Which registered account to target when sending an admin test push. */
export interface SendAdminTestPushRequestDto {
  email: string;
  /** Defaults to a canned admin-test message when omitted. */
  title?: string;
  body?: string;
}

/** Outcome of the push send to one of the account's subscribed devices. */
export interface AdminPushSendOutcomeDto {
  userAgent: string | null;
  ok: boolean;
  /** Present when `ok` is false (rejected/expired subscription, send error…). */
  error?: string;
}

export interface AdminPushSendResponseDto {
  /** How many devices the account had subscribed at send time. */
  subscriptionCount: number;
  results: AdminPushSendOutcomeDto[];
}

/** A push sent to every subscribed device on the instance, not just one account. */
export interface SendAdminBroadcastPushRequestDto {
  /** Defaults to a canned admin-broadcast message when omitted. */
  title?: string;
  body?: string;
}

export interface AdminPushBroadcastResponseDto {
  /** Distinct accounts targeted (at least one active subscription). */
  accountCount: number;
  /** Total devices targeted, across all those accounts. */
  deviceCount: number;
  successCount: number;
  failureCount: number;
}

export interface AdminPushDeviceDto {
  id: string;
  userAgent: string | null;
  createdAt: string;
}
