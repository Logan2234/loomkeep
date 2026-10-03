import {
  type Locale,
  ModerationLegalBasis,
  ModerationMeasure,
  regionalLocale,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";
import { resolveCopyLocale } from "../common/copy-locale.util";
import { QuotaTrackerService } from "../common/quota-tracker.service";
import { primaryWebOrigin } from "../common/web-origin.util";
import {
  MAIL_COPY,
  SECURITY_ALERT_EVENTS,
  type SecurityAlertEvent,
} from "./mail.i18n";

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
export interface JobAlert {
  jobKey: string;
  /** First line of the error message; null once the job has recovered. */
  error: string | null;
}

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
  headers?: Record<string, string>;
}

type TemplateBody = Omit<SendArgs, "to" | "replyTo">;

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

/** The gallery's comma-separated measure field, unknown values dropped. */
function galleryMeasures(raw: string): ModerationMeasure[] {
  const known = Object.values(ModerationMeasure) as string[];
  const measures = raw
    .split(",")
    .map((m) => m.trim())
    .filter((m): m is ModerationMeasure => known.includes(m));
  return measures.length > 0 ? measures : [ModerationMeasure.COMMENT_REMOVED];
}

type MailFooter =
  | { type: "classic" }
  | { type: "admin" }
  | { type: "moderation"; decisionId: string }
  | { type: "communications"; preferencesUrl: string }
  | { type: "unsubscribe"; preferencesUrl: string; unsubscribeUrl: string };

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

const QUACKBACK_EMOJI_ALIASES: Record<string, string> = {
  sparkles: "✨",
  wrench: "🔧",
  bug: "🐛",
  electric_plug: "🔌",
  books: "📚",
  house: "🏠",
};

function renderQuackbackEmojiAliases(text: string): string {
  return text.replace(
    /:(sparkles|wrench|bug|electric_plug|books|house):/g,
    (_match, name: string) => QUACKBACK_EMOJI_ALIASES[name],
  );
}

function isAllowedUrl(value: string, attribute: "href" | "src"): boolean {
  const normalized = value
    .replace(
      /&#(?:x([0-9a-f]+)|([0-9]+));/gi,
      (match, hex: string | undefined, decimal: string | undefined) => {
        const numeric = hex ?? decimal;
        if (!numeric) return match;
        const codePoint = Number.parseInt(numeric, hex === undefined ? 10 : 16);
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
      },
    )
    .replace(/&(colon|tab|newline);/gi, (_match, entity: string) => {
      if (entity.toLowerCase() === "colon") return ":";
      return "";
    })
    .split("")
    .filter((character) => {
      const codePoint = character.charCodeAt(0);
      return (
        character.trim().length > 0 && codePoint > 0x1f && codePoint !== 0x7f
      );
    })
    .join("")
    .toLowerCase();

  if (attribute === "src") return /^https?:/.test(normalized);
  return /^(?:https?:|mailto:)/.test(normalized);
}

function sanitizeHtmlUrls(html: string): string {
  return html.replace(
    /\s(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    (
      match,
      attribute: "href" | "src",
      doubleQuoted,
      singleQuoted,
      unquoted,
    ) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted;
      return isAllowedUrl(value, attribute.toLowerCase() as "href" | "src")
        ? match
        : "";
    },
  );
}

/** Bold/italic/link inline spans within a line — the rest is passed through as-is. */
function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) =>
      isAllowedUrl(url, "href") ? `<a href="${url}">${label}</a>` : label,
    )
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
const COLOR_BG = "#F7F5F3";
const COLOR_SURFACE = "#FFFFFF";
const COLOR_BORDER = "#D3C7A8";
const COLOR_TEXT = "#1C1712";
const COLOR_ACCENT = "#8E620B";
const COLOR_MUTED = "#6B6354";

// Umami Link slugs (see UMAMI_LINKS_BASE_URL in .env.example) — fixed
// naming, created once in the Umami dashboard, not per-deployment config.
// "Voir" (new
// episode) and "Se désinscrire" (newsletter) have no slug here: both carry a
// per-notification/per-recipient value in their destination, and a Link is
// always one fixed URL.
const UMAMI_LINK_SLUG_PASSWORD_CHANGED = "secu-motdepasse";
const UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN = "secu-connexion";
const UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS = "episode-notifs";
const UMAMI_LINK_SLUG_WELCOME = "bienvenue-app";
const UMAMI_LINK_SLUG_NEWSLETTER_CHANGELOG = "newsletter-changelog";
const UMAMI_LINK_SLUG_NEWSLETTER_NOTIFICATIONS = "newsletter-notifs";
const UMAMI_LINK_SLUG_API_KEY_CREATED = "secu-api-creee";
const UMAMI_LINK_SLUG_API_KEY_EXPIRING = "secu-api-expiration";
const UMAMI_LINK_SLUG_API_KEY_LEAKED = "secu-api-fuite";
const UMAMI_LINK_SLUG_SECURITY_ALERT = "secu-alerte";
const UMAMI_LINK_SLUG_INACTIVITY = "compte-inactivite";
const UMAMI_LINK_SLUG_HEADER_SITE = "header-site";
const UMAMI_LINK_SLUG_FOOTER_SITE = "footer-site";

@Injectable()
export class MailService {
  /** Most recent SMTP verification failure, consumed by the admin health probe. */
  lastVerificationError: string | undefined;

  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly supportAddress: string;
  private readonly publicApiUrl: string;
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
    invitation: {
      label: "Invitation à s'inscrire",
      fields: [
        { key: "inviter", label: "Invité par", default: "Logan" },
        { key: "token", label: "Token", default: "sample-invite-token" },
      ],
      build: (locale, v) =>
        this.buildInvitation(
          locale,
          v.inviter || null,
          `${this.webOrigin}/register?invite=${v.token}`,
          new Date(Date.now() + 7 * 24 * 60 * 60_000),
        ),
    },
    passwordResetLink: {
      label: "Lien de réinitialisation",
      fields: [{ key: "token", label: "Token", default: "sample-reset-token" }],
      build: (locale, v) => this.buildPasswordResetLink(locale, v.token),
    },
    passwordChanged: {
      label: "Mot de passe modifié",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
      ],
      build: (locale, v) =>
        this.buildPasswordChanged(locale, 0, new Date(v.occurredAt)),
    },
    emailChangedOld: {
      label: "Email modifié (ancienne adresse)",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "newEmail",
          label: "Nouvelle adresse",
          default: "nouvelle@example.com",
        },
      ],
      build: (locale, v) =>
        this.buildEmailChangedOld(locale, v.newEmail, new Date(v.occurredAt)),
    },
    emailChangedNew: {
      label: "Email modifié (nouvelle adresse)",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "oldEmail",
          label: "Ancienne adresse",
          default: "ancienne@example.com",
        },
      ],
      build: (locale, v) =>
        this.buildEmailChangedNew(locale, v.oldEmail, new Date(v.occurredAt)),
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
    quotaAlert: {
      label: "Alerte de quota fournisseur",
      fields: [
        { key: "provider", label: "Fournisseur", default: "OMDb" },
        { key: "count", label: "Appels du jour", default: "800" },
        { key: "limit", label: "Quota quotidien", default: "1000" },
      ],
      build: (locale, v) => {
        const limit = Number(v.limit) || 1000;
        const count = Number(v.count) || 0;
        return this.buildQuotaAlert(locale, {
          provider: v.provider,
          count,
          limit,
          threshold: count / limit,
        });
      },
    },
    jobAlert: {
      label: "Alerte de job planifié",
      fields: [
        { key: "jobKey", label: "Job", default: "backup.run" },
        {
          key: "status",
          label: "Statut (FAILURE/SUCCESS)",
          default: "FAILURE",
        },
        {
          key: "error",
          label: "Erreur",
          default: "BACKUP_ENCRYPTION_PUBLIC_KEY is not set",
        },
      ],
      build: (locale, v) =>
        this.buildJobAlert(locale, {
          jobKey: v.jobKey,
          error: v.status === "SUCCESS" ? null : v.error,
        }),
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
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "deviceLabel",
          label: "Appareil",
          default: "Chrome · Windows",
        },
        { key: "ip", label: "Adresse IP", default: "203.0.113.42" },
      ],
      build: (locale, v) =>
        this.buildNewDeviceLogin(
          locale,
          v.deviceLabel,
          v.ip || null,
          new Date(v.occurredAt),
        ),
    },
    apiKeyExpiring: {
      label: "Clé API bientôt expirée",
      fields: [
        { key: "name", label: "Nom de la clé", default: "Script perso" },
        { key: "expiresAt", label: "Expiration", default: "2027-01-31" },
      ],
      build: (locale, v) =>
        this.buildApiKeyExpiring(locale, v.name, new Date(v.expiresAt)),
    },
    apiKeyCreated: {
      label: "Clé API créée",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        { key: "name", label: "Nom de la clé", default: "Script perso" },
      ],
      build: (locale, v) =>
        this.buildApiKeyCreated(locale, v.name, new Date(v.occurredAt)),
    },
    apiKeyLeaked: {
      label: "Clé API trouvée en public",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        { key: "name", label: "Nom de la clé", default: "Script perso" },
        {
          key: "foundAt",
          label: "Où elle a été trouvée",
          default: "https://github.com/octocat/dotfiles/blob/main/.env",
        },
      ],
      build: (locale, v) =>
        this.buildApiKeyLeaked(
          locale,
          v.name,
          v.foundAt || null,
          new Date(v.occurredAt),
        ),
    },
    securityAlert: {
      label: "Alerte de sécurité",
      fields: [
        {
          key: "occurredAt",
          label: "Event date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "event",
          label: "Événement (MFA_TOTP_DISABLED, MFA_CHALLENGE_LOCKED…)",
          default: "MFA_TOTP_DISABLED",
        },
      ],
      build: (locale, v) =>
        this.buildSecurityAlert(
          locale,
          SECURITY_ALERT_EVENTS.find((event) => event === v.event) ??
            "MFA_TOTP_DISABLED",
          new Date(v.occurredAt),
        ),
    },
    accountDeleted: {
      label: "Compte supprimé",
      fields: [
        { key: "reason", label: "Raison (self ou inactive)", default: "self" },
      ],
      build: (locale, v) =>
        this.buildAccountDeleted(
          locale,
          v.reason === "inactive" ? "inactive" : "self",
        ),
    },
    adminNewUser: {
      label: "Nouvelle inscription (admins)",
      fields: [{ key: "name", label: "Nom affiché", default: "Alice" }],
      build: (locale, v) => this.buildAdminNewUser(locale, v.name),
    },
    inactivityWarning: {
      label: "Relance compte inactif",
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
          key: "decisionId",
          label: "Decision reference",
          default: "decision-example",
        },
        {
          key: "decidedAt",
          label: "Decision date and time",
          default: "2026-10-03T10:15:00Z",
        },
        {
          key: "measure",
          label:
            "Mesures, séparées par des virgules (COMMENT_REMOVED, REVIEW_REMOVED, LIST_REMOVED, LIST_EDITED, AVATAR_REMOVED, BIO_CLEARED, DISPLAY_NAME_CHANGED, ACCOUNT_SUSPENDED ou ACCOUNT_DELETED)",
          default: "COMMENT_REMOVED",
        },
        {
          key: "suspendedUntil",
          label: "Fin de la désactivation (ACCOUNT_SUSPENDED)",
          default: "2026-10-10T14:20:00Z",
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
          measures: galleryMeasures(v.measure),
          suspendedUntil: new Date(v.suspendedUntil),
          legalBasis:
            v.legalBasis === ModerationLegalBasis.ILLEGAL_CONTENT
              ? ModerationLegalBasis.ILLEGAL_CONTENT
              : ModerationLegalBasis.TOS_BREACH,
          reasonText: v.reasonText,
          tosClause: v.tosClause,
          decisionIds: [v.decisionId],
          decidedAt: new Date(v.decidedAt),
        }),
    },
  };

  constructor(private readonly quota: QuotaTrackerService) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } =
      process.env;
    this.webOrigin = primaryWebOrigin(process.env.WEB_ORIGIN);
    this.from = SMTP_FROM ?? "Loomkeep <noreply@loomkeep.app>";
    this.supportAddress =
      process.env.MAIL_SUPPORT_ADDRESS?.trim() || "contact@loomkeep.app";
    this.publicApiUrl = (
      process.env.PUBLIC_API_URL || `${this.webOrigin}/api`
    ).replace(/\/$/, "");
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
      ...this.buildPasswordResetLink(locale, token),
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
      ...this.buildPasswordChanged(locale, activeApiKeys, occurredAt),
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
      ...this.buildNewDeviceLogin(locale, deviceLabel, ip, occurredAt),
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
      ...this.buildApiKeyCreated(locale, name, occurredAt),
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
      ...this.buildApiKeyExpiring(locale, name, expiresAt),
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
      ...this.buildApiKeyLeaked(locale, name, foundAt, occurredAt),
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
      ...this.buildSecurityAlert(locale, event, occurredAt),
    });
  }

  async sendAccountDeleted(
    recipient: MailRecipient,
    reason: "self" | "inactive",
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildAccountDeleted(locale, reason),
    });
  }

  async sendAdminNewUser(
    recipient: MailRecipient,
    displayName: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildAdminNewUser(locale, displayName),
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
        ...this.buildEmailChangedOld(locale, newEmail, occurredAt),
      }),
      this.send({
        to: newEmail,
        ...this.buildEmailChangedNew(locale, oldEmail, occurredAt),
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
      ...this.buildEmailChangeCode(locale, code),
    });
  }

  async sendMfaEmailCode(
    recipient: MailRecipient,
    code: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildMfaEmailCode(locale, code),
    });
  }

  async sendWelcome(
    recipient: MailRecipient,
    displayName: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildWelcome(locale, displayName),
    });
  }

  async sendVerifyEmail(
    recipient: MailRecipient,
    token: string,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildVerifyEmail(locale, token),
    });
  }

  /** A sign-up invitation (InvitationService) — `url` carries the raw token. */
  async sendInvitation(
    recipient: MailRecipient,
    inviterName: string | null,
    url: string,
    expiresAt: Date,
  ): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildInvitation(locale, inviterName, url, expiresAt),
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
    const locale = resolveCopyLocale(recipient.locale);
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
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildReportsDigest(locale, pendingCount),
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
      ...this.buildQuotaAlert(locale, alert),
    });
  }

  /** Tells an admin a scheduled job started failing, or recovered. */
  async sendJobAlert(recipient: MailRecipient, alert: JobAlert): Promise<void> {
    const locale = resolveCopyLocale(recipient.locale);
    await this.send({
      to: recipient.email,
      ...this.buildJobAlert(locale, alert),
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
    input: ModerationDecisionMail,
  ): Promise<void> {
    await this.send({
      to: recipient.email,
      replyTo: this.supportAddress,
      ...this.buildModerationDecision(
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
      ...this.buildNewsletter(
        resolveCopyLocale(recipient.locale),
        title,
        contentPreview,
        contentHtml,
        unsubscribeToken,
      ),
    });
  }

  private buildQuotaAlert(locale: Locale, alert: QuotaAlert) {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].quotaAlert;
    const percent = Math.round(alert.threshold * 100);
    const sentence = copy.sentence(
      alert.provider,
      percent,
      alert.count.toLocaleString(locale),
      alert.limit.toLocaleString(locale),
    );
    const exhausted = alert.threshold >= 1 ? copy.exhausted : null;
    const url = `${this.webOrigin}/app/admin/services`;
    return {
      subject: `[Admin] ${copy.subject(alert.provider, percent)}`,
      text: [sentence, exhausted, url].filter(Boolean).join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(sentence)}</p>
         ${exhausted ? `<p>${escapeHtml(exhausted)}</p>` : ""}
         ${this.button(url, copy.button)}`,
        { template: "quotaAlert", footer: { type: "admin" } },
      ),
    };
  }

  private buildJobAlert(locale: Locale, alert: JobAlert): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].jobAlert;
    const url = `${this.webOrigin}/app/admin/jobs`;
    const failed = alert.error !== null;
    const sentence = failed
      ? copy.failed(alert.jobKey)
      : copy.recovered(alert.jobKey);
    return {
      subject: `[Admin] ${
        failed
          ? copy.failedSubject(alert.jobKey)
          : copy.recoveredSubject(alert.jobKey)
      }`,
      text: [sentence, alert.error, failed ? copy.onlyOnce : null, url]
        .filter(Boolean)
        .join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(sentence)}</p>
         ${failed ? `<p><code>${escapeHtml(alert.error ?? "")}</code></p><p>${escapeHtml(copy.onlyOnce)}</p>` : ""}
         ${this.button(url, copy.button)}`,
        { template: "jobAlert", footer: { type: "admin" } },
      ),
    };
  }

  private buildReportsDigest(
    locale: Locale,
    pendingCount: number,
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].reportsDigest;
    const url = `${this.webOrigin}/app/admin/reports`;
    return {
      subject: `[Admin] ${copy.subject(pendingCount)}`,
      text: `${copy.sentence(pendingCount)}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${copy.sentence(pendingCount).replace(String(pendingCount), `<strong>${pendingCount}</strong>`)}</p>
         ${this.button(url, copy.button)}`,
        { template: "reportsDigest", footer: { type: "admin" } },
      ),
    };
  }

  /**
   * The five DSA art. 17 mentions: nature of the measure, facts invoked,
   * legal/contractual basis, non-automated character, redress. `tosClause`
   * is only meaningful when legalBasis is TOS_BREACH — ILLEGAL_CONTENT states
   * the illegality ground instead. Several measures taken on one report share
   * one notice, which names each of them.
   */
  private buildModerationDecision(
    locale: Locale,
    input: ModerationDecisionMail,
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].moderation;
    const until = input.suspendedUntil
      ? this.formatEventDate(locale, input.suspendedUntil)
      : "";
    const variants = input.measures.map((measure) =>
      measure === ModerationMeasure.ACCOUNT_SUSPENDED
        ? {
            measure: copy.suspended.measure(until),
            subject: copy.suspended.subject,
          }
        : {
            [ModerationMeasure.COMMENT_REMOVED]: copy.comment,
            [ModerationMeasure.REVIEW_REMOVED]: copy.review,
            [ModerationMeasure.LIST_REMOVED]: copy.listRemoved,
            [ModerationMeasure.LIST_EDITED]: copy.listEdited,
            [ModerationMeasure.AVATAR_REMOVED]: copy.avatar,
            [ModerationMeasure.BIO_CLEARED]: copy.bio,
            [ModerationMeasure.DISPLAY_NAME_CHANGED]: copy.displayName,
            [ModerationMeasure.ACCOUNT_DELETED]: copy.account,
          }[measure],
    );
    const subject =
      variants.length === 1 ? variants[0].subject : copy.severalSubject;
    const measures = variants.map((v) => v.measure);
    const measureText =
      measures.length > 1
        ? `${measures.slice(0, -1).join(", ")} ${copy.and} ${measures.at(-1)}`
        : measures[0];
    const basisText =
      input.legalBasis === ModerationLegalBasis.ILLEGAL_CONTENT
        ? copy.illegalBasis
        : copy.tosBasis(input.tosClause);
    const intro = copy.intro(measureText);
    const reference = copy.reference(input.decisionIds.join(", "));
    const decidedAt = copy.decidedAt(
      this.formatEventDate(locale, input.decidedAt),
    );
    const appeal = copy.appeal.replace(
      "contact@loomkeep.app",
      this.supportAddress,
    );

    return {
      subject,
      text: `${reference}\n${decidedAt}\n\n${intro}\n\n${copy.factsLabel}: ${input.reasonText}\n\n${copy.basisLabel}: ${basisText}.\n\n${copy.humanDecision}\n\n${appeal}`,
      html: this.wrapEmail(
        locale,
        subject,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(reference)}<br>${escapeHtml(decidedAt)}</p>
         <p>${escapeHtml(intro)}</p>
         <p><strong>${escapeHtml(copy.factsLabel)}:</strong> ${escapeHtml(input.reasonText)}</p>
         <p><strong>${escapeHtml(copy.basisLabel)}:</strong> ${escapeHtml(basisText)}.</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.humanDecision)}</p>
         <p>${escapeHtml(appeal)}</p>`,
        {
          template: "moderationDecision",
          footer: { type: "moderation", decisionId: input.decisionIds[0] },
        },
      ),
    };
  }

  /**
   * 24 months without a login/session refresh trigger this notice,
   * naming the exact date the account is due for automatic deletion (36
   * months of inactivity) unless the account is used again before then.
   */
  private buildInactivityWarning(
    locale: Locale,
    deletionDate: Date,
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].inactivity;
    const formattedDate = new Intl.DateTimeFormat(
      regionalLocale(resolveCopyLocale(locale)),
      {
        dateStyle: "long",
        timeZone: "UTC",
      },
    ).format(deletionDate);
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_INACTIVITY) ?? `${this.webOrigin}/login`;
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
        { template: "inactivityWarning" },
      ),
    };
  }

  private buildPasswordResetLink(locale: Locale, token: string): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].passwordReset;
    const url = `${this.webOrigin}/reset-password?token=${encodeURIComponent(token)}`;
    return {
      subject: copy.subject,
      text: `${copy.intro}\n\n${url}\n\n${copy.expiry}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         ${this.button(url, copy.button)}
         ${this.fallbackLink(locale, url)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>`,
        { template: "passwordResetLink" },
      ),
    };
  }

  private buildPasswordChanged(
    locale: Locale,
    activeApiKeys = 0,
    occurredAt = new Date(),
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].passwordChanged;
    const apiKeys = activeApiKeys > 0 ? copy.apiKeys(activeApiKeys) : null;
    // The old password no longer works, so a link into the app (which needs
    // a session) would be a dead end for the "it wasn't me" case — the
    // account may already be compromised. The reset flow works regardless,
    // since it's requested by email, not by an existing session.
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_PASSWORD_CHANGED) ??
      `${this.webOrigin}/forgot-password`;
    return {
      subject: copy.subject,
      text: [
        `${copy.intro} ${copy.warning}${apiKeys ? `\n\n${apiKeys}` : ""}\n\n${url}`,
        this.eventTime(locale, occurredAt),
      ].join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(this.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${apiKeys ? `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(apiKeys)}</p>` : ""}
         ${this.button(url, copy.button)}`,
        { template: "passwordChanged" },
      ),
    };
  }

  private buildNewDeviceLogin(
    locale: Locale,
    deviceLabelValue: string | null,
    ip: string | null,
    occurredAt = new Date(),
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].newDevice;
    const deviceLabel = deviceLabelValue ?? copy.unknownDevice;
    const ipSuffix = ip ? ` (IP ${ip})` : "";
    const ipTextSuffix = ip ? ` (IP ${ip})` : "";
    // Unlike password-changed/email-changed, the account likely isn't
    // compromised yet here — just an unrecognized device gained access — so
    // the reader is probably still logged in on their own trusted device and
    // can reach in-app settings directly.
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN) ??
      `${this.webOrigin}/app/settings/security`;
    return {
      subject: copy.subject,
      text: [
        `${copy.intro(deviceLabel, ipTextSuffix)} ${copy.warning}\n\n${url}`,
        this.eventTime(locale, occurredAt),
      ].join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(this.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(deviceLabel, ipSuffix))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${this.button(url, copy.button)}`,
        { template: "newDeviceLogin" },
      ),
    };
  }

  private buildApiKeyCreated(
    locale: Locale,
    name: string,
    occurredAt = new Date(),
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].apiKeyCreated;
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_API_KEY_CREATED) ??
      `${this.webOrigin}/app/settings/integrations`;
    return {
      subject: copy.subject,
      text: [
        `${copy.intro(name)} ${copy.warning}

${url}`,
        this.eventTime(locale, occurredAt),
      ].join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(this.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(name))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${this.button(url, copy.button)}`,
        { template: "apiKeyCreated" },
      ),
    };
  }

  private buildApiKeyExpiring(
    locale: Locale,
    name: string,
    expiresAt: Date,
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].apiKeyExpiring;
    const date = new Intl.DateTimeFormat(
      regionalLocale(resolveCopyLocale(locale)),
      { dateStyle: "long", timeZone: "UTC" },
    ).format(expiresAt);
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_API_KEY_EXPIRING) ??
      `${this.webOrigin}/app/settings/integrations`;
    return {
      subject: copy.subject(name),
      text: `${copy.intro(name, date)} ${copy.hint}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro(name, date))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>
         ${this.button(url, copy.button)}`,
        { template: "apiKeyExpiring" },
      ),
    };
  }

  private buildApiKeyLeaked(
    locale: Locale,
    name: string,
    foundAt: string | null,
    occurredAt = new Date(),
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].apiKeyLeaked;
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_API_KEY_LEAKED) ??
      `${this.webOrigin}/app/settings/integrations`;
    const where = foundAt ? `${copy.foundAt} ${foundAt}` : null;
    return {
      subject: copy.subject(name),
      text: [
        [copy.intro(name), where, copy.hint, url].filter(Boolean).join("\n\n"),
        this.eventTime(locale, occurredAt),
      ].join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(this.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(name))}</p>
         ${where ? `<p style="overflow-wrap:anywhere;">${escapeHtml(where)}</p>` : ""}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>
         ${this.button(url, copy.button)}`,
        { template: "apiKeyLeaked" },
      ),
    };
  }

  private buildSecurityAlert(
    locale: Locale,
    event: SecurityAlertEvent,
    occurredAt = new Date(),
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].securityAlert;
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_SECURITY_ALERT) ??
      `${this.webOrigin}/app/settings/security`;
    const hint = event === "MFA_CHALLENGE_LOCKED" ? copy.lockedHint : copy.hint;
    return {
      subject: copy.subject,
      text: [
        `${copy.events[event]} ${hint}\n\n${url}`,
        this.eventTime(locale, occurredAt),
      ].join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(this.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.events[event])}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(hint)}</p>
         ${this.button(url, copy.button)}`,
        { template: "securityAlert" },
      ),
    };
  }

  private buildAccountDeleted(
    locale: Locale,
    reason: "self" | "inactive",
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].accountDeleted;
    const intro = reason === "inactive" ? copy.inactive : copy.self;
    return {
      subject: copy.subject,
      text: `${intro}\n\n${copy.outro}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(intro)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.outro)}</p>`,
        { template: "accountDeleted" },
      ),
    };
  }

  private buildAdminNewUser(locale: Locale, displayName: string): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].adminNewUser;
    const url = `${this.webOrigin}/app/admin/users`;
    return {
      subject: `[Admin] ${copy.subject(displayName)}`,
      text: `${copy.intro(displayName)}\n\n${url}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro(displayName))}</p>
         ${this.button(url, copy.button)}`,
        { template: "adminNewUser", footer: { type: "admin" } },
      ),
    };
  }

  private buildEmailChangedOld(
    locale: Locale,
    newEmail: string,
    occurredAt = new Date(),
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].emailChangedOld;
    // The account's login email has already changed (and possibly the
    // password too, if compromised), so a link into the app or a reset flow
    // tied to either address can't be assumed to reach the real owner —
    // direct contact is the only reliable path here.
    const url = `mailto:${this.supportAddress}`;
    return {
      subject: copy.subject,
      text: [
        `${copy.intro(newEmail)} ${copy.warning} ${url}`,
        this.eventTime(locale, occurredAt),
      ].join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(this.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(newEmail))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${this.button(url, copy.button)}`,
        { template: "emailChangedOld" },
      ),
    };
  }

  private buildEmailChangedNew(
    locale: Locale,
    oldEmail: string,
    occurredAt = new Date(),
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].emailChangedNew;
    return {
      subject: copy.subject,
      text: [
        `${copy.intro(oldEmail)}\n\n${copy.warning} mailto:${this.supportAddress}`,
        this.eventTime(locale, occurredAt),
      ].join("\n\n"),
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(this.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(oldEmail))}</p>
         <p>${escapeHtml(copy.warning)} <a href="mailto:${escapeHtml(this.supportAddress)}" style="color:${COLOR_ACCENT};">${escapeHtml(this.supportAddress)}</a></p>`,
        { template: "emailChangedNew" },
      ),
    };
  }

  private buildEmailChangeCode(locale: Locale, code: string): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].emailChangeCode;
    const safety = MAIL_COPY[resolveCopyLocale(locale)].layout.codeSafety;
    return {
      subject: copy.subject,
      text: `${copy.intro} ${code}\n\n${copy.expiry}\n\n${safety}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         <p style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:5px;background:${COLOR_BG};border:1px solid ${COLOR_BORDER};padding:18px 8px;color:${COLOR_ACCENT};text-align:center;margin:24px 0;">${escapeHtml(code)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(safety)}</p>`,
        { template: "emailChangeCode" },
      ),
    };
  }

  private buildMfaEmailCode(locale: Locale, code: string): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].mfaCode;
    const safety = MAIL_COPY[resolveCopyLocale(locale)].layout.codeSafety;
    return {
      subject: copy.subject,
      text: `${copy.intro} ${code}\n\n${copy.expiry}\n\n${safety}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         <p style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:5px;background:${COLOR_BG};border:1px solid ${COLOR_BORDER};padding:18px 8px;color:${COLOR_ACCENT};text-align:center;margin:24px 0;">${escapeHtml(code)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(safety)}</p>`,
        { template: "mfaEmailCode" },
      ),
    };
  }

  private buildWelcome(locale: Locale, displayName: string): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].welcome;
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
        { template: "welcome" },
      ),
    };
  }

  private buildVerifyEmail(locale: Locale, token: string): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].verifyEmail;
    const url = `${this.webOrigin}/verify-email?token=${encodeURIComponent(token)}`;
    const unexpected =
      MAIL_COPY[resolveCopyLocale(locale)].layout.unexpectedVerification;
    return {
      subject: copy.subject,
      text: `${copy.intro}\n\n${url}\n\n${copy.expiry}\n\n${unexpected}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro)}</p>
         ${this.button(url, copy.button)}
         ${this.fallbackLink(locale, url)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(unexpected)}</p>`,
        { template: "verifyEmail" },
      ),
    };
  }

  private buildInvitation(
    locale: Locale,
    inviterName: string | null,
    url: string,
    expiresAt: Date,
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].invitation;
    const formattedDate = new Intl.DateTimeFormat(
      regionalLocale(resolveCopyLocale(locale)),
      {
        dateStyle: "long",
        timeZone: "UTC",
      },
    ).format(expiresAt);
    return {
      subject: copy.subject(inviterName),
      text: `${copy.intro(inviterName)}\n\n${url}\n\n${copy.expiry(formattedDate)}`,
      html: this.wrapEmail(
        locale,
        copy.heading,
        `<p>${escapeHtml(copy.intro(inviterName))}</p>
         ${this.button(url, copy.button)}
         ${this.fallbackLink(locale, url)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry(formattedDate))}</p>`,
        { template: "invitation" },
      ),
    };
  }

  /**
   * DRAFT WORDING — needs Logan's sign-off before any real send goes out
   * (see the notification-digest feature plan). Three tiers by item count
   * (1 / 2-4 / 5+) rather than one gabarit per event type, `period` only
   * changes the "aujourd'hui"/"ces 7 derniers jours" framing.
   */
  private buildEpisodeDigest(
    locale: Locale,
    items: { title: string; body: string; url: string }[],
    period: "daily" | "weekly",
  ): TemplateBody {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].episodeDigest;
    const periodLabel = period === "daily" ? copy.today : copy.thisWeek;
    const prefsUrl =
      this.umamiLink(UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS) ??
      `${this.webOrigin}/app/settings/communications`;

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
      text: `${intro}\n\n${listText}\n\n${MAIL_COPY[resolveCopyLocale(locale)].layout.seriesReason}\n${copy.preferences}: ${prefsUrl}`,
      html: this.wrapEmail(
        locale,
        subject,
        `<p>${escapeHtml(intro)}</p>${listHtml}`,
        {
          template: "episodeDigest",
          footer: { type: "communications", preferencesUrl: prefsUrl },
        },
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
    const copy = MAIL_COPY[resolveCopyLocale(locale)].newsletter;
    const entryUrl =
      this.umamiLink(UMAMI_LINK_SLUG_NEWSLETTER_CHANGELOG) ??
      "https://feedback.loomkeep.app/changelog";
    const prefsUrl =
      this.umamiLink(UMAMI_LINK_SLUG_NEWSLETTER_NOTIFICATIONS) ??
      `${this.webOrigin}/app/settings/communications`;
    // Carries a per-recipient token in its query string, so — like "Voir"
    // above — it can't go through a Link (one fixed URL per Link, this one
    // is different for every recipient). Works without being logged in
    // (RGPD art. 7-3: withdrawing consent must be as easy as giving it) — a
    // single click, no session required. The settings link above stays for
    // anyone who wants finer-grained control instead of unsubscribing
    // outright.
    const unsubscribeUrl = `${this.webOrigin}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    // renderChangelogMarkdown always drives the plain-text alt (contentPreview
    // is short but still real Markdown) and is also the HTML fallback for
    // callers with no Quackback HTML to show (the template gallery). When the
    // webhook did carry contentHtml, prefer it for the HTML body instead of
    // the 200-char preview — same pre-sanitized-by-Quackback trust boundary
    // its own email integration relies on (self-hosted, single-admin-authored
    // content, reached only through the signed webhook).
    const { html: fallbackHtml, text: contentText } =
      this.renderChangelogMarkdown(contentPreview);
    const bodyHtml = contentHtml
      ? sanitizeHtmlUrls(renderQuackbackEmojiAliases(contentHtml))
      : fallbackHtml;

    return {
      subject: `Loomkeep — ${title}`,
      text: `${title}\n\n${contentText}\n\n${entryUrl}\n\n${copy.reason} ${copy.preferences}: ${prefsUrl}\n${copy.unsubscribe}: ${unsubscribeUrl}`,
      headers: this.newsletterHeaders(unsubscribeToken),
      html: this.wrapEmail(
        locale,
        title,
        `${bodyHtml}
         ${this.button(entryUrl, copy.button)}`,
        {
          template: "newsletter",
          eyebrow: copy.eyebrow,
          footer: {
            type: "unsubscribe",
            preferencesUrl: prefsUrl,
            unsubscribeUrl,
          },
        },
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

    for (const rawLine of renderQuackbackEmojiAliases(markdown).split("\n")) {
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

  /** Inline styles provide the baseline; the media query only adjusts mobile spacing. */
  private wrapEmail(
    locale: Locale,
    title: string,
    bodyHtml: string,
    options: {
      template: keyof typeof MAIL_COPY.fr.preheaders;
      eyebrow?: string;
      footer?: MailFooter;
    },
  ): string {
    const footer: MailFooter = options.footer ?? { type: "classic" };
    const copy = MAIL_COPY[resolveCopyLocale(locale)].layout;
    const siteUrl =
      footer.type === "admin"
        ? this.webOrigin
        : (this.umamiLink(UMAMI_LINK_SLUG_HEADER_SITE) ?? this.webOrigin);
    return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  .email-content a { color:${COLOR_ACCENT}; }
  .email-content .email-button { color:#ffffff; }
  @media only screen and (max-width:480px) {
    .email-header { padding:23px 22px !important; }
    .email-content { padding:28px 22px 12px !important; }
    .email-footer { padding:0 22px 20px !important; }
    .email-title { font-size:26px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${COLOR_BG};">
<div class="email-preheader" aria-hidden="true" style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(MAIL_COPY[resolveCopyLocale(locale)].preheaders[options.template])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR_BG};font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${COLOR_SURFACE};border:1px solid ${COLOR_BORDER};table-layout:fixed;">
        <tr>
          <td class="email-header" style="padding:25px 34px;background:#0C0D10;border-top:4px solid #F5B841;">
            <a href="${escapeHtml(siteUrl)}" style="display:inline-block;color:#FFFFFF;text-decoration:none;font-family:'Trebuchet MS',Arial,sans-serif;font-size:25px;font-weight:700;line-height:36px;"><img src="${escapeHtml(this.webOrigin)}/pwa-192.png" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:10px;">Loomkeep</a>
            <p style="margin:8px 0 0;font-size:12px;color:#D3C7A8;line-height:1.5;">${escapeHtml(copy.tagline)}</p>
          </td>
        </tr>
        <tr>
          <td class="email-content" style="padding:32px 34px 12px;color:${COLOR_TEXT};font-size:16px;line-height:1.65;overflow-wrap:anywhere;word-wrap:break-word;">
            ${
              options.eyebrow
                ? `<p style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR_ACCENT};margin:0 0 8px;">${escapeHtml(options.eyebrow)}</p>`
                : ""
            }
            <h1 class="email-title" style="font-family:'Trebuchet MS',Arial,sans-serif;font-size:30px;line-height:1.15;letter-spacing:-0.6px;margin:0 0 20px;color:${COLOR_TEXT};">${escapeHtml(title)}</h1>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td class="email-footer" style="padding:0 34px 22px;color:${COLOR_MUTED};font-size:13px;line-height:1.6;">
            <div style="border-top:1px solid ${COLOR_BORDER};padding-top:14px;">${this.renderFooter(locale, footer)}</div>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  private renderFooter(locale: Locale, footer: MailFooter): string {
    const copy = MAIL_COPY[resolveCopyLocale(locale)].layout;
    const host = new URL(this.webOrigin).host;
    const link = (url: string, label: string) =>
      `<a href="${escapeHtml(url)}" style="display:inline-block;padding:3px 0;color:${COLOR_ACCENT};text-decoration:underline;">${escapeHtml(label)}</a>`;
    const contact = link(`mailto:${this.supportAddress}`, copy.contact);
    const separator = ` <span style="padding:0 8px;color:${COLOR_MUTED};">·</span> `;

    if (footer.type === "admin") {
      return `${escapeHtml(copy.adminReason(host))}<br>${link(`${this.webOrigin}/app/admin`, copy.adminLink)}`;
    }

    if (footer.type === "moderation") {
      const url = new URL(`mailto:${this.supportAddress}`);
      url.searchParams.set("subject", `Loomkeep — ${footer.decisionId}`);
      return `${escapeHtml(copy.appealReason)}<br>${link(url.href, copy.appealLink)}`;
    }

    if (footer.type === "communications" || footer.type === "unsubscribe") {
      const reason =
        footer.type === "unsubscribe"
          ? copy.newsletterReason
          : copy.seriesReason;
      const unsubscribe =
        footer.type === "unsubscribe"
          ? `${separator}${link(footer.unsubscribeUrl, copy.unsubscribe)}`
          : "";
      return `${escapeHtml(reason)}<br>${link(footer.preferencesUrl, copy.preferences)}${unsubscribe}${separator}${link(`mailto:${this.supportAddress}`, copy.shortContact)}`;
    }

    const siteUrl =
      this.umamiLink(UMAMI_LINK_SLUG_FOOTER_SITE) ?? this.webOrigin;
    return `${link(siteUrl, host)}${separator}${contact}`;
  }

  private formatEventDate(locale: Locale, date: Date): string {
    return new Intl.DateTimeFormat(regionalLocale(resolveCopyLocale(locale)), {
      dateStyle: "long",
      timeStyle: "long",
      timeZone: "UTC",
    }).format(date);
  }

  private eventTime(locale: Locale, date: Date): string {
    return MAIL_COPY[resolveCopyLocale(locale)].layout.eventAt(
      this.formatEventDate(locale, date),
    );
  }

  private newsletterHeaders(token: string): Record<string, string> | undefined {
    const url = new URL(
      `${this.publicApiUrl}/newsletter/unsubscribe/one-click`,
    );
    if (url.protocol !== "https:") return undefined;
    url.searchParams.set("token", token);
    return {
      "List-Unsubscribe": `<${url.href}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  private fallbackLink(locale: Locale, url: string): string {
    const label = MAIL_COPY[resolveCopyLocale(locale)].layout.fallback;
    return `<p style="color:${COLOR_MUTED};font-size:13px;line-height:1.6;">${escapeHtml(label)}<br><a href="${escapeHtml(url)}" style="color:${COLOR_ACCENT};text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(url)}</a></p>`;
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
      <a class="email-button" href="${escapeHtml(url)}" style="display:inline-block;max-width:100%;box-sizing:border-box;background:${COLOR_TEXT};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.4;padding:13px 23px;border-radius:4px;">${escapeHtml(label)}</a>
    </p>`;
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
        replyTo: replyTo ?? this.supportAddress,
        ...(headers ? { headers } : {}),
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
      return false;
    }
  }
}
