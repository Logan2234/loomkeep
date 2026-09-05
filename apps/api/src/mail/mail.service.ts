import {
  type Locale,
  ModerationLegalBasis,
  ModerationMeasure,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";
import { QuotaTrackerService } from "../common/quota-tracker.service";
import { dateLocale, MAIL_COPY, resolveMailLocale } from "./mail.i18n";

export interface MailRecipient {
  email: string;
  locale: string;
}

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Overrides the default no-reply `from` for replies — see sendModerationDecision. */
  replyTo?: string;
}

type TemplateBody = Omit<SendArgs, "to" | "replyTo">;

/** One editable sample-data field for a gallery template (e.g. the recipient's display name). */
export interface MailTemplateField {
  key: string;
  label: string;
  default: string;
  /** Renders as a `<textarea>` in the admin gallery instead of a single-line input. */
  multiline?: boolean;
}

/** Escapes dynamic text before it is placed in HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bold/italic/link inline spans within a line — the rest is passed through as-is. */
function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}

export interface MailTemplateInfo {
  key: string;
  label: string;
  fields: MailTemplateField[];
}

// Séance palette (light/"programme" variant — the only one that renders
// reliably across mail clients, which ignore prefers-color-scheme and web
// fonts). See design-identity-seance memory for the source palette.
const COLOR_BG = "#EDECE8";
const COLOR_SURFACE = "#FBFAF7";
const COLOR_BORDER = "#DAD8D0";
const COLOR_TEXT = "#17181C";
const COLOR_ACCENT = "#A56A15";
const COLOR_MUTED = "#8A8880";

// Umami Link slugs (see root README "Analytics") — fixed naming, created
// once in the Umami dashboard, not per-deployment config. "Voir" (new
// episode) and "Se désinscrire" (newsletter) have no slug here: both carry a
// per-notification/per-recipient value in their destination, and a Link is
// always one fixed URL.
const UMAMI_LINK_SLUG_PASSWORD_CHANGED = "secu-motdepasse";
const UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN = "secu-connexion";
const UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS = "episode-notifs";
const UMAMI_LINK_SLUG_WELCOME = "bienvenue-app";
const UMAMI_LINK_SLUG_NEWSLETTER_CHANGELOG = "newsletter-changelog";
const UMAMI_LINK_SLUG_NEWSLETTER_NOTIFICATIONS = "newsletter-notifs";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  /** Public web app origin, for links inside emails (reset, verify…). */
  private readonly webOrigin: string;
  /**
   * Base URL for Umami Link short-URLs (see docker-compose.umami.yml) —
   * undefined whenever unset (no Umami deployed, or a self-hoster's own
   * Umami without these Links configured), in which case each build*
   * method below falls back to the direct destination URL. Never hardcode
   * a *.loomkeep.app URL here directly: this code also runs for
   * self-hosters, who don't have (or want) their visitors routed through
   * the official instance's analytics. The slugs themselves (below) are
   * fixed naming, not per-deployment config — adding a Link for a future
   * email is a code change (a new slug constant) plus creating the
   * matching Link in Umami, not a new env var.
   */
  private readonly umamiLinksBaseUrl: string | undefined;

  /**
   * Every template, keyed for the admin preview/test-send gallery. `fields`
   * describes the editable sample data (admin can override any of them to
   * test edge cases — long text, special characters…); `build` must render
   * without any live user/request context, since the gallery calls it out
   * of band with just those field values (defaults if not overridden).
   */
  private readonly templates: Record<
    string,
    {
      label: string;
      fields: MailTemplateField[];
      build: (locale: Locale, values: Record<string, string>) => TemplateBody;
    }
  > = {
    welcome: {
      label: "Bienvenue",
      fields: [{ key: "displayName", label: "Nom", default: "Alice" }],
      build: (locale, v) => this.buildWelcome(locale, v.displayName),
    },
    verifyEmail: {
      label: "Confirmation d'email",
      fields: [
        { key: "token", label: "Token", default: "sample-verify-token" },
      ],
      build: (locale, v) => this.buildVerifyEmail(locale, v.token),
    },
    passwordResetLink: {
      label: "Lien de réinitialisation",
      fields: [{ key: "token", label: "Token", default: "sample-reset-token" }],
      build: (locale, v) => this.buildPasswordResetLink(locale, v.token),
    },
    passwordChanged: {
      label: "Mot de passe modifié",
      fields: [],
      build: (locale) => this.buildPasswordChanged(locale),
    },
    emailChangedOld: {
      label: "Email modifié (ancienne adresse)",
      fields: [
        {
          key: "newEmail",
          label: "Nouvelle adresse",
          default: "nouvelle@example.com",
        },
      ],
      build: (locale, v) => this.buildEmailChangedOld(locale, v.newEmail),
    },
    emailChangedNew: {
      label: "Email modifié (nouvelle adresse)",
      fields: [
        {
          key: "oldEmail",
          label: "Ancienne adresse",
          default: "ancienne@example.com",
        },
      ],
      build: (locale, v) => this.buildEmailChangedNew(locale, v.oldEmail),
    },
    emailChangeCode: {
      label: "Code de confirmation d'email",
      fields: [{ key: "code", label: "Code", default: "482913" }],
      build: (locale, v) => this.buildEmailChangeCode(locale, v.code),
    },
    mfaEmailCode: {
      label: "Code MFA (connexion)",
      fields: [{ key: "code", label: "Code", default: "482913" }],
      build: (locale, v) => this.buildMfaEmailCode(locale, v.code),
    },
    newsletter: {
      label: "Newsletter (nouveautés)",
      fields: [
        {
          key: "title",
          label: "Titre",
          default: "Loomkeep 1.3.0",
        },
        {
          key: "content",
          label: "Contenu (Markdown, comme sur Quackback)",
          default:
            "Here's what's changing in this version.\n\n## New\n\n- Calendar subscription: subscribe to your Loomkeep release calendar from Google/Apple Calendar.\n- A feedback board! Suggest ideas and report bugs.\n\n## Improvements\n\n- Password strength requirements are now shown live while you type.",
          multiline: true,
        },
      ],
      // Sample token — the gallery renders out of band, with no real
      // recipient/subscription to mint one for. No real Quackback HTML to
      // preview here either, so this always exercises the Markdown fallback.
      build: (locale, v) =>
        this.buildNewsletter(locale, v.title, v.content, "", "preview-token"),
    },
    episodeDigest: {
      label: "Digest de sorties (email)",
      fields: [
        { key: "itemCount", label: "Nombre d'épisodes (1-6)", default: "1" },
        { key: "period", label: "Période (daily ou weekly)", default: "daily" },
      ],
      build: (locale, v) => {
        const count = Math.max(1, Math.min(6, Number(v.itemCount) || 1));
        const sampleTitles = [
          "One Piece",
          "Loki",
          "The Bear",
          "Arcane",
          "Shogun",
          "Severance",
        ];
        const items = Array.from({ length: count }, (_, i) => ({
          title: sampleTitles[i % sampleTitles.length],
          body: `S1E${i + 1}`,
          url: "/app/media/series/12345",
        }));
        return this.buildEpisodeDigest(
          locale,
          items,
          v.period === "weekly" ? "weekly" : "daily",
        );
      },
    },
    reportsDigest: {
      label: "Digest des signalements",
      fields: [
        {
          key: "pendingCount",
          label: "Signalements en attente",
          default: "3",
        },
      ],
      build: (locale, v) =>
        this.buildReportsDigest(locale, Number(v.pendingCount) || 0),
    },
    newDeviceLogin: {
      label: "Nouvelle connexion (appareil inconnu)",
      fields: [
        {
          key: "deviceLabel",
          label: "Appareil",
          default: "Chrome · Windows",
        },
        { key: "ip", label: "Adresse IP", default: "203.0.113.42" },
      ],
      build: (locale, v) =>
        this.buildNewDeviceLogin(locale, v.deviceLabel, v.ip || null),
    },
    inactivityWarning: {
      label: "Relance compte inactif (LK-C06)",
      fields: [
        {
          key: "deletionDate",
          label: "Date de suppression prévue",
          default: "2028-08-15",
        },
      ],
      build: (locale, v) =>
        this.buildInactivityWarning(locale, new Date(v.deletionDate)),
    },
    moderationDecision: {
      label: "Décision de modération (DSA art. 17)",
      fields: [
        {
          key: "measure",
          label: "Mesure (COMMENT_REMOVED ou ACCOUNT_DELETED)",
          default: "COMMENT_REMOVED",
        },
        {
          key: "legalBasis",
          label: "Base (ILLEGAL_CONTENT ou TOS_BREACH)",
          default: "TOS_BREACH",
        },
        {
          key: "reasonText",
          label: "Faits retenus",
          default: "Propos insultants répétés envers un autre utilisateur.",
          multiline: true,
        },
        {
          key: "tosClause",
          label: "Clause CGU / fondement",
          default: "§7 — Règles de conduite",
        },
      ],
      build: (locale, v) =>
        this.buildModerationDecision(locale, {
          measure:
            v.measure === ModerationMeasure.ACCOUNT_DELETED
              ? ModerationMeasure.ACCOUNT_DELETED
              : ModerationMeasure.COMMENT_REMOVED,
          legalBasis:
            v.legalBasis === ModerationLegalBasis.ILLEGAL_CONTENT
              ? ModerationLegalBasis.ILLEGAL_CONTENT
              : ModerationLegalBasis.TOS_BREACH,
          reasonText: v.reasonText,
          tosClause: v.tosClause,
        }),
    },
  };

  constructor(private readonly quota: QuotaTrackerService) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } =
      process.env;
    this.webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
    this.from = SMTP_FROM ?? "Loomkeep <noreply@loomkeep.app>";
    this.umamiLinksBaseUrl = process.env.UMAMI_LINKS_BASE_URL || undefined;

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const port = Number(SMTP_PORT ?? 587);
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
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
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
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
      resolveMailLocale(locale),
      this.resolveFieldValues(template.fields, overrides),
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
        resolveMailLocale(recipient.locale),
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
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildPasswordResetLink(locale, token),
    });
  }

  async sendPasswordChanged(recipient: MailRecipient): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildPasswordChanged(locale),
    });
  }

  async sendNewDeviceLogin(
    recipient: MailRecipient,
    deviceLabel: string | null,
    ip: string | null,
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildNewDeviceLogin(locale, deviceLabel, ip),
    });
  }

  async sendEmailChanged(
    oldEmail: string,
    newEmail: string,
    localeValue: string,
  ): Promise<void> {
    const locale = resolveMailLocale(localeValue);
    await Promise.all([
      this.send({
        to: oldEmail,
        ...this.buildEmailChangedOld(locale, newEmail),
      }),
      this.send({
        to: newEmail,
        ...this.buildEmailChangedNew(locale, oldEmail),
      }),
    ]);
  }

  async sendEmailChangeCode(
    recipient: MailRecipient,
    code: string,
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildEmailChangeCode(locale, code),
    });
  }

  async sendMfaEmailCode(
    recipient: MailRecipient,
    code: string,
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildMfaEmailCode(locale, code),
    });
  }

  async sendWelcome(
    recipient: MailRecipient,
    displayName: string,
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildWelcome(locale, displayName),
    });
  }

  async sendVerifyEmail(
    recipient: MailRecipient,
    token: string,
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildVerifyEmail(locale, token),
    });
  }

  /**
   * The recurring "new episode" digest — see NotificationDigestService,
   * which is the only caller and already guarantees `items` is non-empty.
   */
  async sendEpisodeDigest(
    recipient: MailRecipient,
    items: { title: string; body: string; url: string }[],
    period: "daily" | "weekly",
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildEpisodeDigest(locale, items, period),
    });
  }

  /** Daily admin-only summary of pending moderation reports. Only sent when `pendingCount > 0`. */
  async sendReportsDigest(
    recipient: MailRecipient,
    pendingCount: number,
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildReportsDigest(locale, pendingCount),
    });
  }

  /**
   * LK-C06: warns an inactive account it will be deleted on `deletionDate`
   * (the account-preservation notice required before InactiveAccountService's
   * automatic purge). Sent regardless of `notifyEmail` — this is a retention
   * notice, not a marketing/feature email.
   */
  async sendInactivityWarning(
    recipient: MailRecipient,
    deletionDate: Date,
  ): Promise<void> {
    const locale = resolveMailLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildInactivityWarning(locale, deletionDate),
    });
  }

  /**
   * DSA art. 17 statement of reasons for a restrictive measure. `replyTo`
   * lets the sanctioned user contest by replying directly, per the notice's
   * own text — the default `from` is a no-reply address.
   */
  async sendModerationDecision(
    recipient: MailRecipient,
    input: {
      measure: ModerationMeasure;
      reasonText: string;
      legalBasis: ModerationLegalBasis;
      tosClause: string;
    },
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      replyTo: "contact@loomkeep.app",
      ...this.buildModerationDecision(
        resolveMailLocale(recipient.locale),
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
      ...this.buildNewsletter(
        resolveMailLocale(recipient.locale),
        title,
        contentPreview,
        contentHtml,
        unsubscribeToken,
      ),
    });
  }

  private buildReportsDigest(
    locale: Locale,
    pendingCount: number,
  ): TemplateBody {
    const copy = MAIL_COPY[locale].reportsDigest;
    const url = `${this.webOrigin}/app/admin/reports`;
    return {
      subject: copy.subject(pendingCount),
      text: `${copy.sentence(pendingCount)}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${copy.sentence(pendingCount).replace(String(pendingCount), `<strong>${pendingCount}</strong>`)}</p>
         ${this.button(url, copy.button)}`,
      ),
    };
  }

  /**
   * The five DSA art. 17 mentions: nature of the measure, facts invoked,
   * legal/contractual basis, non-automated character, redress. `tosClause`
   * is only meaningful when legalBasis is TOS_BREACH — ILLEGAL_CONTENT states
   * the illegality ground instead.
   */
  private buildModerationDecision(
    locale: Locale,
    input: {
      measure: ModerationMeasure;
      reasonText: string;
      legalBasis: ModerationLegalBasis;
      tosClause: string;
    },
  ): TemplateBody {
    const copy = MAIL_COPY[locale].moderation;
    const variant =
      input.measure === ModerationMeasure.COMMENT_REMOVED
        ? copy.comment
        : copy.account;
    const basisText =
      input.legalBasis === ModerationLegalBasis.ILLEGAL_CONTENT
        ? copy.illegalBasis
        : copy.tosBasis(input.tosClause);
    const intro = copy.intro(variant.measure);

    return {
      subject: variant.subject,
      text: `${intro}\n\n${copy.factsLabel}: ${input.reasonText}\n\n${copy.basisLabel}: ${basisText}.\n\n${copy.humanDecision}\n\n${copy.appeal}`,
      html: this.wrapEmail(
        locale,
        variant.subject,
        `<p>${escapeHtml(intro)}</p>
         <p><strong>${escapeHtml(copy.factsLabel)}:</strong> ${escapeHtml(input.reasonText)}</p>
         <p><strong>${escapeHtml(copy.basisLabel)}:</strong> ${escapeHtml(basisText)}.</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.humanDecision)}</p>
         <p>${escapeHtml(copy.appeal).replace("contact@loomkeep.app", '<a href="mailto:contact@loomkeep.app">contact@loomkeep.app</a>')}</p>`,
      ),
    };
  }

  /**
   * LK-C06: 24 months without a login/session refresh trigger this notice,
   * naming the exact date the account is due for automatic deletion (36
   * months of inactivity) unless the account is used again before then.
   */
  private buildInactivityWarning(
    locale: Locale,
    deletionDate: Date,
  ): TemplateBody {
    const copy = MAIL_COPY[locale].inactivity;
    const formattedDate = new Intl.DateTimeFormat(dateLocale(locale), {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(deletionDate);
    const url = `${this.webOrigin}/login`;
    return {
      subject: copy.subject,
      text: `${copy.text(formattedDate)}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         <p>${escapeHtml(copy.policy(formattedDate))}</p>
         ${this.button(url, copy.button)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>`,
      ),
    };
  }

  private buildPasswordResetLink(locale: Locale, token: string): TemplateBody {
    const copy = MAIL_COPY[locale].passwordReset;
    const url = `${this.webOrigin}/reset-password?token=${token}`;
    return {
      subject: copy.subject,
      text: `${copy.intro}\n\n${url}\n\n${copy.expiry}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         ${this.button(url, copy.button)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>`,
      ),
    };
  }

  private buildPasswordChanged(locale: Locale): TemplateBody {
    const copy = MAIL_COPY[locale].passwordChanged;
    // The old password no longer works, so a link into the app (which needs
    // a session) would be a dead end for the "it wasn't me" case — the
    // account may already be compromised. The reset flow works regardless,
    // since it's requested by email, not by an existing session.
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_PASSWORD_CHANGED) ??
      `${this.webOrigin}/forgot-password`;
    return {
      subject: copy.subject,
      text: `${copy.intro} ${copy.warning}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${this.button(url, copy.button)}`,
      ),
    };
  }

  private buildNewDeviceLogin(
    locale: Locale,
    deviceLabelValue: string | null,
    ip: string | null,
  ): TemplateBody {
    const copy = MAIL_COPY[locale].newDevice;
    const deviceLabel = deviceLabelValue ?? copy.unknownDevice;
    const ipSuffix = ip ? ` (IP ${ip})` : "";
    const ipTextSuffix = ip ? ` (IP ${ip})` : "";
    // Unlike password-changed/email-changed, the account likely isn't
    // compromised yet here — just an unrecognized device gained access — so
    // the reader is probably still logged in on their own trusted device and
    // can reach in-app settings directly.
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN) ??
      `${this.webOrigin}/app/settings#securite`;
    return {
      subject: copy.subject,
      text: `${copy.intro(deviceLabel, ipTextSuffix)} ${copy.warning}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro(deviceLabel, ipSuffix))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${this.button(url, copy.button)}`,
      ),
    };
  }

  private buildEmailChangedOld(locale: Locale, newEmail: string): TemplateBody {
    const copy = MAIL_COPY[locale].emailChangedOld;
    // The account's login email has already changed (and possibly the
    // password too, if compromised), so a link into the app or a reset flow
    // tied to either address can't be assumed to reach the real owner —
    // direct contact is the only reliable path here.
    const url = "mailto:contact@loomkeep.app";
    return {
      subject: copy.subject,
      text: `${copy.intro(newEmail)} ${copy.warning} ${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro(newEmail))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${this.button(url, copy.button)}`,
      ),
    };
  }

  private buildEmailChangedNew(locale: Locale, oldEmail: string): TemplateBody {
    const copy = MAIL_COPY[locale].emailChangedNew;
    return {
      subject: copy.subject,
      text: copy.intro(oldEmail),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro(oldEmail))}</p>`,
      ),
    };
  }

  private buildEmailChangeCode(locale: Locale, code: string): TemplateBody {
    const copy = MAIL_COPY[locale].emailChangeCode;
    return {
      subject: copy.subject,
      text: `${copy.intro} ${code}\n\n${copy.expiry}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         <p style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:${COLOR_ACCENT};text-align:center;margin:24px 0;">${escapeHtml(code)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>`,
      ),
    };
  }

  private buildMfaEmailCode(locale: Locale, code: string): TemplateBody {
    const copy = MAIL_COPY[locale].mfaCode;
    return {
      subject: copy.subject,
      text: `${copy.intro} ${code}\n\n${copy.expiry}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         <p style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:${COLOR_ACCENT};text-align:center;margin:24px 0;">${escapeHtml(code)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>`,
      ),
    };
  }

  private buildWelcome(locale: Locale, displayName: string): TemplateBody {
    const copy = MAIL_COPY[locale].welcome;
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_WELCOME) ?? `${this.webOrigin}/app`;
    return {
      subject: copy.subject,
      text: `${copy.intro(displayName)}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.subject,
        `<p>${escapeHtml(copy.intro(displayName))}</p>
         ${this.button(url, copy.button)}`,
      ),
    };
  }

  private buildVerifyEmail(locale: Locale, token: string): TemplateBody {
    const copy = MAIL_COPY[locale].verifyEmail;
    const url = `${this.webOrigin}/verify-email?token=${token}`;
    return {
      subject: copy.subject,
      text: `${copy.intro}\n\n${url}\n\n${copy.expiry}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         ${this.button(url, copy.button)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>`,
      ),
    };
  }

  /**
   * DRAFT WORDING — needs Logan's sign-off before any real send goes out
   * (see the notification-digest feature plan). Three tiers by item count
   * (1 / 2-4 / 5+) rather than one gabarit per event type, `period` only
   * changes the "aujourd'hui"/"cette semaine" framing.
   */
  private buildEpisodeDigest(
    locale: Locale,
    items: { title: string; body: string; url: string }[],
    period: "daily" | "weekly",
  ): TemplateBody {
    const copy = MAIL_COPY[locale].episodeDigest;
    const periodLabel = period === "daily" ? copy.today : copy.thisWeek;
    const prefsUrl =
      this.umamiLink(UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS) ??
      `${this.webOrigin}/app/settings#communications`;

    const listHtml = items
      .map(
        (i) =>
          `<p style="margin:0 0 16px;"><a href="${this.webOrigin}${i.url}" style="color:${COLOR_TEXT};font-weight:600;text-decoration:none;">${escapeHtml(i.title)}</a><br/><span style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(i.body)}</span></p>`,
      )
      .join("");
    const listText = items
      .map((i) => `${i.title} — ${i.body}\n${this.webOrigin}${i.url}`)
      .join("\n\n");

    let subject: string;
    let intro: string;

    if (items.length === 1) {
      subject = copy.oneSubject(items[0].title);
      intro = copy.oneIntro(periodLabel);
    } else if (items.length <= 4) {
      subject = copy.severalSubject(items.length, periodLabel);
      intro = copy.severalIntro(periodLabel);
    } else {
      subject = copy.manySubject(items.length, periodLabel);
      intro = copy.manyIntro(items.length, periodLabel);
    }

    return {
      subject,
      text: `${intro}\n\n${listText}\n\n${copy.preferences}: ${prefsUrl}`,
      html: this.wrapEmail(
        locale,
        subject,
        `<p>${escapeHtml(intro)}</p>${listHtml}<p style="color:${COLOR_MUTED};font-size:12px;margin-top:24px;text-align:center;"><a href="${prefsUrl}" style="color:${COLOR_MUTED};">${escapeHtml(copy.preferences)}</a></p>`,
      ),
    };
  }

  private buildNewsletter(
    locale: Locale,
    title: string,
    contentPreview: string,
    contentHtml: string,
    unsubscribeToken: string,
  ): TemplateBody {
    const copy = MAIL_COPY[locale].newsletter;
    const entryUrl =
      this.umamiLink(UMAMI_LINK_SLUG_NEWSLETTER_CHANGELOG) ??
      "https://feedback.loomkeep.app/changelog";
    const prefsUrl =
      this.umamiLink(UMAMI_LINK_SLUG_NEWSLETTER_NOTIFICATIONS) ??
      `${this.webOrigin}/app/settings#communications`;
    // Carries a per-recipient token in its query string, so — like "Voir"
    // above — it can't go through a Link (one fixed URL per Link, this one
    // is different for every recipient). Works without being logged in
    // (RGPD art. 7-3: withdrawing consent must be as easy as giving it) — a
    // single click, no session required. The settings link above stays for
    // anyone who wants finer-grained control instead of unsubscribing
    // outright.
    const unsubscribeUrl = `${this.webOrigin}/unsubscribe?token=${unsubscribeToken}`;
    // renderChangelogMarkdown always drives the plain-text alt (contentPreview
    // is short but still real Markdown) and is also the HTML fallback for
    // callers with no Quackback HTML to show (the template gallery). When the
    // webhook did carry contentHtml, prefer it for the HTML body instead of
    // the 200-char preview — same pre-sanitized-by-Quackback trust boundary
    // its own email integration relies on (self-hosted, single-admin-authored
    // content, reached only through the signed webhook).
    const { html: fallbackHtml, text: contentText } =
      this.renderChangelogMarkdown(contentPreview);
    const bodyHtml = contentHtml || fallbackHtml;

    return {
      subject: `Loomkeep — ${title}`,
      text: `${title}\n\n${contentText}\n\n${entryUrl}\n\n${copy.reason} ${copy.preferences}: ${prefsUrl}\n${copy.unsubscribe}: ${unsubscribeUrl}`,
      html: this.wrapEmail(
        locale,
        title,
        `${bodyHtml}
         ${this.button(entryUrl, copy.button)}
         <p style="color:${COLOR_MUTED};font-size:12px;margin-top:24px;text-align:center;">${escapeHtml(copy.reason)} · <a href="${prefsUrl}" style="color:${COLOR_MUTED};">${escapeHtml(copy.preferences)}</a> · <a href="${unsubscribeUrl}" style="color:${COLOR_MUTED};">${escapeHtml(copy.unsubscribe)}</a></p>`,
        copy.eyebrow,
      ),
    };
  }

  /**
   * Renders the subset of Markdown Quackback's changelog template actually
   * produces (intro paragraph, `## ` section headings, `- `/`* ` bullet
   * lists, inline bold/italic/link spans) — not a general Markdown parser.
   * Anything outside that subset (tables, code blocks, nested lists…) falls
   * through as a plain paragraph rather than being dropped.
   */
  private renderChangelogMarkdown(markdown: string): {
    html: string;
    text: string;
  } {
    const htmlBlocks: string[] = [];
    const textLines: string[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length === 0) return;
      const items = listItems
        .map(
          (item) =>
            `<li style="border-left:2px solid ${COLOR_ACCENT};padding:2px 0 2px 12px;margin-bottom:10px;list-style:none;">${renderInline(item)}</li>`,
        )
        .join("");
      htmlBlocks.push(`<ul style="margin:0 0 20px;padding:0;">${items}</ul>`);
      listItems = [];
    };

    for (const rawLine of markdown.split("\n")) {
      const line = rawLine.trim();

      if (line.length === 0) continue;

      const heading = /^##\s+(.+)/.exec(line);
      const bullet = /^[-*]\s+(.+)/.exec(line);

      if (heading) {
        flushList();
        htmlBlocks.push(
          `<h2 style="font-size:15px;font-weight:700;color:${COLOR_TEXT};margin:24px 0 10px;">${renderInline(heading[1])}</h2>`,
        );
        textLines.push(`\n${heading[1]}`);
      } else if (bullet) {
        listItems.push(bullet[1]);
        textLines.push(`• ${bullet[1]}`);
      } else {
        flushList();
        htmlBlocks.push(
          `<p style="margin:0 0 16px;">${renderInline(line)}</p>`,
        );
        textLines.push(line);
      }
    }

    flushList();

    return { html: htmlBlocks.join("\n"), text: textLines.join("\n").trim() };
  }

  /**
   * Wraps mail body HTML in the shared Loomkeep header/footer. Inline CSS
   * only — mail clients don't load stylesheets. `eyebrow` is a small label
   * above the title (e.g. a release stamp) — the mono stack matches the
   * "timecode" convention used for version/episode numbers across the app
   * (see DESIGN.md), degrading to a generic monospace font in mail clients
   * that don't ship Space Mono.
   */
  private wrapEmail(
    locale: Locale,
    title: string,
    bodyHtml: string,
    eyebrow?: string,
  ): string {
    return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR_BG};padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:${COLOR_SURFACE};border:1px solid ${COLOR_BORDER};border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid ${COLOR_BORDER};">
            <span style="font-size:18px;font-weight:700;letter-spacing:0.3px;color:${COLOR_TEXT};">Loomkeep</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:${COLOR_TEXT};font-size:15px;line-height:1.6;">
            ${
              eyebrow
                ? `<p style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR_ACCENT};margin:0 0 8px;">${escapeHtml(eyebrow)}</p>`
                : ""
            }
            <h1 style="font-size:19px;margin:0 0 16px;color:${COLOR_ACCENT};">${escapeHtml(title)}</h1>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:${COLOR_BG};color:${COLOR_MUTED};font-size:12px;text-align:center;">
            Loomkeep
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  /** The Umami Link short-URL for a slug, or undefined when no base URL is configured. */
  private umamiLink(slug: string): string | undefined {
    return this.umamiLinksBaseUrl
      ? `${this.umamiLinksBaseUrl}/${slug}`
      : undefined;
  }

  /** Email-safe button: a styled `<a>`, since `<button>` is unreliable across mail clients. */
  private button(url: string, label: string): string {
    return `<p style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:${COLOR_ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">${escapeHtml(label)}</a>
    </p>`;
  }

  private async send({
    to,
    subject,
    text,
    html,
    replyTo,
  }: SendArgs): Promise<void> {
    if (!this.transporter) return;

    try {
      this.quota.record("smtp");
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
        ...(replyTo ? { replyTo } : {}),
      });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
    }
  }
}
