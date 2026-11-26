import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";
import { resolveCopyLocale } from "../common/copy-locale.util";
import { configuredSupportAddress } from "../common/instance-defaults";
import { QuotaTrackerService } from "../common/quota-tracker.service";
import { primaryWebOrigin } from "../common/web-origin.util";
import { mailGallery } from "./mail-gallery";
import { MailLayout } from "./mail-layout";
import type { SecurityAlertEvent } from "./mail.i18n";
import type {
  DigestMailItem,
  GalleryTemplate,
  ImportAlert,
  JobAlert,
  MailRecipient,
  MailTemplateField,
  MailTemplateInfo,
  ModerationDecisionMail,
  PausedReminderItem,
  QuotaAlert,
  SendArgs,
  TemplateBody,
} from "./mail.types";
import {
  buildAccountDeleted,
  buildAccountDeletionCancelled,
  buildAccountDeletionReminder,
  buildAccountDeletionScheduled,
  buildEmailChangeCode,
  buildEmailChangedNew,
  buildEmailChangedOld,
  buildInactivityWarning,
  buildInvitation,
  buildMfaEmailCode,
  buildNewDeviceLogin,
  buildPasswordChanged,
  buildPasswordResetLink,
  buildSecurityAlert,
  buildVerifyEmail,
  buildWelcome,
} from "./templates/account";
import {
  buildAdminNewUser,
  buildImportAlert,
  buildJobAlert,
  buildQuotaAlert,
  buildReportsDigest,
  buildUpdateAvailable,
} from "./templates/admin";
import {
  buildApiKeyCreated,
  buildApiKeyExpiring,
  buildApiKeyLeaked,
} from "./templates/api-keys";
import {
  buildEpisodeDigest,
  buildPausedReminder,
  buildSagaSequel,
} from "./templates/library";
import { buildModerationDecision } from "./templates/moderation";
import { buildNewsletter } from "./templates/newsletter";

/** `support@example.com` from `Name <support@example.com>` (or a bare address). */
function bareAddress(from: string): string {
  return /<([^>]+)>/.exec(from)?.[1]?.trim() ?? from.trim();
}

@Injectable()
export class MailService {
  /** Most recent SMTP verification failure, consumed by the admin health probe. */
  lastVerificationError: string | undefined;

  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly supportAddress: string;
  /** Default Reply-To: the configured support mailbox, if there is one. */
  private readonly replyTo: string | undefined;
  /** Header, footer, buttons and links every template is drawn with. */
  private readonly layout: MailLayout;
  /** The admin preview/test-send gallery, keyed by template. */
  private readonly templates: Record<string, GalleryTemplate>;

  constructor(private readonly quota: QuotaTrackerService) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } =
      process.env;
    const webOrigin = primaryWebOrigin(process.env.WEB_ORIGIN);
    this.from =
      SMTP_FROM?.trim() || `Loomkeep <noreply@${new URL(webOrigin).hostname}>`;
    this.replyTo = configuredSupportAddress(
      process.env.MAIL_SUPPORT_ADDRESS,
      webOrigin,
    );
    // Without a support mailbox, contact links point at the instance's own
    // sender and replies go to it (no Reply-To): never to Loomkeep's.
    this.supportAddress = this.replyTo ?? bareAddress(this.from);
    this.layout = new MailLayout({
      webOrigin,
      supportAddress: this.supportAddress,
      publicApiUrl: (process.env.PUBLIC_API_URL || `${webOrigin}/api`).replace(
        /\/$/,
        "",
      ),
      umamiLinksBaseUrl: process.env.UMAMI_LINKS_BASE_URL || undefined,
    });
    this.templates = mailGallery(this.layout);

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const port = Number(SMTP_PORT ?? 587);
      const secure = port === 465;
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure,
        // Without it, someone on the path who strips the server's STARTTLS
        // offer gets the SMTP password and every reset link in clear. Only a
        // relay on the same host or network may opt out.
        requireTLS: !secure && process.env.SMTP_REQUIRE_TLS !== "false",
        // Password reset, email change and MFA codes wait on the send:
        // nodemailer's own defaults would hold them for minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      if (!this.replyTo) {
        this.logger.warn(
          `MAIL_SUPPORT_ADDRESS not set — contact links in emails use the sender (${this.supportAddress})`,
        );
      }
    } else {
      // Self-host without SMTP configured: mail is a no-op, the rest of the
      // app still works (mirrors PushService's VAPID-less fallback).
      this.transporter = null;
      this.logger.warn("SMTP not configured — outgoing email is disabled");
    }
  }

  /** Whether SMTP credentials are present (outgoing email is enabled). */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /**
   * Opens (and closes) an SMTP connection to check the relay is reachable and
   * the credentials are accepted. Returns `false` on any failure rather than
   * throwing — the admin status page treats it as "down".
   */
  async verifyConnection(): Promise<boolean> {
    this.lastVerificationError = undefined;
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.lastVerificationError =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`SMTP verify failed: ${String(error)}`);
      return false;
    }
  }

  /** Every template available in the admin preview/test-send gallery, with its editable fields. */
  listTemplates(): MailTemplateInfo[] {
    return Object.entries(this.templates).map(([key, { label, fields }]) => ({
      key,
      label,
      fields,
    }));
  }

  /**
   * Renders one template for admin preview (never sent). `overrides` replaces
   * a field's default sample value when present and non-empty — lets the
   * admin test edge cases (long text, special characters) without touching code.
   */
  renderTemplatePreview(
    key: string,
    locale: string = "fr",
    overrides?: Record<string, string>,
  ): TemplateBody | null {
    const template = this.templates[key];
    if (!template) return null;
    return template.build(
      resolveCopyLocale(locale),
      this.resolveFieldValues(template.fields, overrides),
    );
  }

  /** A newsletter as it went out, minus its per-recipient unsubscribe link. */
  renderNewsletterPreview(
    locale: string,
    title: string,
    contentPreview: string,
    contentHtml: string,
  ): TemplateBody {
    return buildNewsletter(
      this.layout,
      resolveCopyLocale(locale),
      title,
      contentPreview,
      contentHtml,
      "preview-token",
    );
  }

  /** Sends one template, rendered with the same (possibly overridden) sample data as the preview, to `to`. */
  async sendTemplateTest(
    key: string,
    recipient: MailRecipient,
    overrides?: Record<string, string>,
  ): Promise<boolean> {
    const template = this.templates[key];
    if (!template) return false;
    await this.send({
      to: recipient.email,
      ...template.build(
        resolveCopyLocale(recipient.locale),
        this.resolveFieldValues(template.fields, overrides),
      ),
    });
    return true;
  }

  private resolveFieldValues(
    fields: MailTemplateField[],
    overrides?: Record<string, string>,
  ): Record<string, string> {
    const values: Record<string, string> = {};

    for (const field of fields) {
      const override = overrides?.[field.key];
      values[field.key] = override ? override : field.default;
    }

    return values;
  }

  async sendPasswordResetLink(
    recipient: MailRecipient,
    token: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildPasswordResetLink(this.layout, locale, token),
    });
  }

  async sendPasswordChanged(
    recipient: MailRecipient,
    activeApiKeys = 0,
    occurredAt = new Date(),
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildPasswordChanged(this.layout, locale, activeApiKeys, occurredAt),
    });
  }

  async sendNewDeviceLogin(
    recipient: MailRecipient,
    deviceLabel: string | null,
    ip: string | null,
    occurredAt = new Date(),
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildNewDeviceLogin(this.layout, locale, deviceLabel, ip, occurredAt),
    });
  }

  async sendApiKeyCreated(
    recipient: MailRecipient,
    name: string,
    occurredAt = new Date(),
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildApiKeyCreated(this.layout, locale, name, occurredAt),
    });
  }

  async sendApiKeyExpiring(
    recipient: MailRecipient,
    name: string,
    expiresAt: Date,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildApiKeyExpiring(this.layout, locale, name, expiresAt),
    });
  }

  async sendSagaSequel(
    recipient: MailRecipient,
    title: string,
    saga: string,
    path: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildSagaSequel(this.layout, locale, title, saga, path),
    });
  }

  async sendApiKeyLeaked(
    recipient: MailRecipient,
    name: string,
    foundAt: string | null,
    occurredAt = new Date(),
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildApiKeyLeaked(this.layout, locale, name, foundAt, occurredAt),
    });
  }

  async sendSecurityAlert(
    recipient: MailRecipient,
    event: SecurityAlertEvent,
    occurredAt = new Date(),
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildSecurityAlert(this.layout, locale, event, occurredAt),
    });
  }

  async sendAccountDeleted(
    recipient: MailRecipient,
    reason: "self" | "inactive",
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildAccountDeleted(this.layout, locale, reason),
    });
  }

  async sendAccountDeletionScheduled(
    recipient: MailRecipient,
    scheduledFor: Date,
    cancelToken: string,
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      ...buildAccountDeletionScheduled(
        this.layout,
        resolveCopyLocale(recipient.locale),
        scheduledFor,
        cancelToken,
      ),
    });
  }

  async sendAccountDeletionReminder(
    recipient: MailRecipient,
    scheduledFor: Date,
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      ...buildAccountDeletionReminder(
        this.layout,
        resolveCopyLocale(recipient.locale),
        scheduledFor,
      ),
    });
  }

  async sendAccountDeletionCancelled(recipient: MailRecipient): Promise<void> {
    await this.send({
      to: recipient.email,
      replyTo: this.supportAddress,
      ...buildAccountDeletionCancelled(
        this.layout,
        resolveCopyLocale(recipient.locale),
      ),
    });
  }

  async sendUpdateAvailable(
    recipient: MailRecipient,
    current: string,
    latest: string,
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      ...buildUpdateAvailable(
        this.layout,
        resolveCopyLocale(recipient.locale),
        current,
        latest,
      ),
    });
  }

  async sendPausedReminder(
    recipient: MailRecipient,
    items: PausedReminderItem[],
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      ...buildPausedReminder(
        this.layout,
        resolveCopyLocale(recipient.locale),
        items,
      ),
    });
  }

  async sendAdminNewUser(
    recipient: MailRecipient,
    displayName: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildAdminNewUser(this.layout, locale, displayName),
    });
  }

  async sendEmailChanged(
    oldEmail: string,
    newEmail: string,
    localeValue: string,
    occurredAt = new Date(),
  ): Promise<void> {
    const locale = resolveCopyLocale(localeValue);
    await Promise.all([
      this.send({
        to: oldEmail,
        ...buildEmailChangedOld(this.layout, locale, newEmail, occurredAt),
      }),
      this.send({
        to: newEmail,
        ...buildEmailChangedNew(this.layout, locale, oldEmail, occurredAt),
      }),
    ]);
  }

  async sendEmailChangeCode(
    recipient: MailRecipient,
    code: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildEmailChangeCode(this.layout, locale, code),
    });
  }

  async sendMfaEmailCode(
    recipient: MailRecipient,
    code: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildMfaEmailCode(this.layout, locale, code),
    });
  }

  async sendWelcome(
    recipient: MailRecipient,
    displayName: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildWelcome(this.layout, locale, displayName),
    });
  }

  async sendVerifyEmail(
    recipient: MailRecipient,
    token: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildVerifyEmail(this.layout, locale, token),
    });
  }

  /** A sign-up invitation (InvitationService) — `url` carries the raw token. */
  async sendInvitation(
    recipient: MailRecipient,
    inviterName: string | null,
    url: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const locale = resolveCopyLocale(recipient.locale);
    return this.send({
      to: recipient.email,
      ...buildInvitation(this.layout, locale, inviterName, url, expiresAt),
    });
  }

  /**
   * The recurring "new episode" digest — see NotificationDigestService,
   * which is the only caller and already guarantees `items` is non-empty.
   */
  async sendEpisodeDigest(
    recipient: MailRecipient,
    items: DigestMailItem[],
    period: "daily" | "weekly",
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildEpisodeDigest(this.layout, locale, items, period),
    });
  }

  /** Daily admin-only summary of pending moderation reports. Only sent when `pendingCount > 0`. */
  async sendReportsDigest(
    recipient: MailRecipient,
    pendingCount: number,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildReportsDigest(this.layout, locale, pendingCount),
    });
  }

  /** Tells an admin a provider reached an alert threshold of its daily quota. */
  async sendQuotaAlert(
    recipient: MailRecipient,
    alert: QuotaAlert,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildQuotaAlert(this.layout, locale, alert),
    });
  }

  /** Tells an admin a scheduled job started failing, or recovered. */
  async sendJobAlert(recipient: MailRecipient, alert: JobAlert): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildJobAlert(this.layout, locale, alert),
    });
  }

  /** Tells an admin that someone's import failed while being applied. */
  async sendImportAlert(
    recipient: MailRecipient,
    alert: ImportAlert,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...buildImportAlert(this.layout, locale, alert),
    });
  }

  /**
   * warns an inactive account it will be deleted on `deletionDate`
   * (the account-preservation notice required before InactiveAccountService's
   * automatic purge). Sent regardless of `notifyEmail` — this is a retention
   * notice, not a marketing/feature email.
   */
  /** Resolves false when the email didn't go out (no SMTP, or it failed). */
  async sendInactivityWarning(
    recipient: MailRecipient,
    deletionDate: Date,
  ): Promise<boolean> {
    const locale = resolveCopyLocale(recipient.locale);
    return this.send({
      to: recipient.email,
      ...buildInactivityWarning(this.layout, locale, deletionDate),
    });
  }

  /**
   * DSA art. 17 statement of reasons for a restrictive measure. `replyTo`
   * lets the sanctioned user contest by replying directly, per the notice's
   * own text — the default `from` is a no-reply address.
   */
  async sendModerationDecision(
    recipient: MailRecipient,
    input: ModerationDecisionMail,
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      replyTo: this.supportAddress,
      ...buildModerationDecision(
        this.layout,
        resolveCopyLocale(recipient.locale),
        input,
      ),
    });
  }

  /** Release newsletter — sent automatically when a changelog entry is published on Quackback (see NewsletterService). */
  async sendNewsletter(
    recipient: MailRecipient,
    title: string,
    contentPreview: string,
    contentHtml: string,
    unsubscribeToken: string,
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      ...buildNewsletter(
        this.layout,
        resolveCopyLocale(recipient.locale),
        title,
        contentPreview,
        contentHtml,
        unsubscribeToken,
      ),
    });
  }

  private async send({
    to,
    subject,
    text,
    html,
    replyTo,
    headers,
  }: SendArgs): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      this.quota.record("smtp");
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
        ...((replyTo ?? this.replyTo)
          ? { replyTo: replyTo ?? this.replyTo }
          : {}),
        ...(headers ? { headers } : {}),
      });
      return true;
    } catch (err) {
      // Neither the recipient nor the SMTP server's text, which usually
      // quotes the address: logs are kept 30 days and reach GlitchTip.
      const { code, responseCode } = err as {
        code?: string;
        responseCode?: number;
      };
      this.logger.error(
        `Failed to send "${subject}" (${code ?? "unknown"}${responseCode ? ` ${responseCode}` : ""})`,
      );
      return false;
    }
  }
}
