import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";
import { QuotaTrackerService } from "../common/quota-tracker.service";

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

type TemplateBody = Omit<SendArgs, "to">;

/** One editable sample-data field for a gallery template (e.g. the recipient's display name). */
export interface MailTemplateField {
  key: string;
  label: string;
  default: string;
  /** Renders as a `<textarea>` in the admin gallery instead of a single-line input. */
  multiline?: boolean;
}

/** Escapes text pulled from Quackback content before it's placed in HTML. */
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
      build: (values: Record<string, string>) => TemplateBody;
    }
  > = {
    welcome: {
      label: "Bienvenue",
      fields: [{ key: "displayName", label: "Nom", default: "Alice" }],
      build: (v) => this.buildWelcome(v.displayName),
    },
    verifyEmail: {
      label: "Confirmation d'email",
      fields: [
        { key: "token", label: "Token", default: "sample-verify-token" },
      ],
      build: (v) => this.buildVerifyEmail(v.token),
    },
    passwordResetLink: {
      label: "Lien de réinitialisation",
      fields: [{ key: "token", label: "Token", default: "sample-reset-token" }],
      build: (v) => this.buildPasswordResetLink(v.token),
    },
    passwordChanged: {
      label: "Mot de passe modifié",
      fields: [],
      build: () => this.buildPasswordChanged(),
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
      build: (v) => this.buildEmailChangedOld(v.newEmail),
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
      build: (v) => this.buildEmailChangedNew(v.oldEmail),
    },
    emailChangeCode: {
      label: "Code de confirmation d'email",
      fields: [{ key: "code", label: "Code", default: "482913" }],
      build: (v) => this.buildEmailChangeCode(v.code),
    },
    newEpisode: {
      label: "Nouvel épisode",
      fields: [
        { key: "mediaTitle", label: "Titre", default: "One Piece" },
        {
          key: "body",
          label: "Message",
          default: "L'épisode 1089 est disponible.",
        },
        { key: "path", label: "Chemin", default: "/app/media/series/12345" },
      ],
      build: (v) => this.buildNewEpisode(v.mediaTitle, v.body, v.path),
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
      // recipient/subscription to mint one for.
      build: (v) => this.buildNewsletter(v.title, v.content, "preview-token"),
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
      build: (v) => this.buildReportsDigest(Number(v.pendingCount) || 0),
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
      build: (v) => this.buildNewDeviceLogin(v.deviceLabel, v.ip || null),
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
    overrides?: Record<string, string>,
  ): TemplateBody | null {
    const template = this.templates[key];
    if (!template) return null;
    return template.build(this.resolveFieldValues(template.fields, overrides));
  }

  /** Sends one template, rendered with the same (possibly overridden) sample data as the preview, to `to`. */
  async sendTemplateTest(
    key: string,
    to: string,
    overrides?: Record<string, string>,
  ): Promise<boolean> {
    const template = this.templates[key];
    if (!template) return false;
    await this.send({
      to,
      ...template.build(this.resolveFieldValues(template.fields, overrides)),
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

  async sendPasswordResetLink(to: string, token: string): Promise<void> {
    await this.send({ to, ...this.buildPasswordResetLink(token) });
  }

  async sendPasswordChanged(to: string): Promise<void> {
    await this.send({ to, ...this.buildPasswordChanged() });
  }

  async sendNewDeviceLogin(
    to: string,
    deviceLabel: string,
    ip: string | null,
  ): Promise<void> {
    await this.send({ to, ...this.buildNewDeviceLogin(deviceLabel, ip) });
  }

  async sendEmailChanged(oldEmail: string, newEmail: string): Promise<void> {
    await Promise.all([
      this.send({ to: oldEmail, ...this.buildEmailChangedOld(newEmail) }),
      this.send({ to: newEmail, ...this.buildEmailChangedNew(oldEmail) }),
    ]);
  }

  async sendEmailChangeCode(to: string, code: string): Promise<void> {
    await this.send({ to, ...this.buildEmailChangeCode(code) });
  }

  async sendWelcome(to: string, displayName: string): Promise<void> {
    await this.send({ to, ...this.buildWelcome(displayName) });
  }

  async sendVerifyEmail(to: string, token: string): Promise<void> {
    await this.send({ to, ...this.buildVerifyEmail(token) });
  }

  async sendNewEpisode(
    to: string,
    mediaTitle: string,
    body: string,
    path: string,
  ): Promise<void> {
    await this.send({
      to,
      ...this.buildNewEpisode(mediaTitle, body, path),
    });
  }

  /** Daily admin-only summary of pending moderation reports. Only sent when `pendingCount > 0`. */
  async sendReportsDigest(to: string, pendingCount: number): Promise<void> {
    await this.send({ to, ...this.buildReportsDigest(pendingCount) });
  }

  /** Release newsletter — sent automatically when a changelog entry is published on Quackback (see NewsletterService). */
  async sendNewsletter(
    to: string,
    title: string,
    content: string,
    unsubscribeToken: string,
  ): Promise<void> {
    await this.send({
      to,
      ...this.buildNewsletter(title, content, unsubscribeToken),
    });
  }

  private buildReportsDigest(pendingCount: number): TemplateBody {
    const url = `${this.webOrigin}/app/admin/reports`;
    const label = pendingCount > 1 ? "signalements" : "signalement";
    return {
      subject: `${pendingCount} ${label} en attente de modération`,
      text: `${pendingCount} ${label} en attente de modération sur Loomkeep.\n\n${url}`,
      html: this.wrapEmail(
        "Signalements en attente",
        `<p><strong>${pendingCount}</strong> ${label} en attente de modération.</p>
         ${this.button(url, "Voir la file de modération")}`,
      ),
    };
  }

  private buildPasswordResetLink(token: string): TemplateBody {
    const url = `${this.webOrigin}/reset-password?token=${token}`;
    return {
      subject: "Réinitialise ton mot de passe Loomkeep",
      text: `Un lien de réinitialisation a été demandé pour ton compte Loomkeep.\n\n${url}\n\nCe lien expire dans 1h. Si tu n'es pas à l'origine de cette demande, ignore cet email.`,
      html: this.wrapEmail(
        "Réinitialise ton mot de passe",
        `<p>Un lien de réinitialisation a été demandé pour ton compte Loomkeep.</p>
         ${this.button(url, "Réinitialiser mon mot de passe")}
         <p style="color:${COLOR_MUTED};font-size:13px;">Ce lien expire dans 1h. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
      ),
    };
  }

  private buildPasswordChanged(): TemplateBody {
    // The old password no longer works, so a link into the app (which needs
    // a session) would be a dead end for the "it wasn't me" case — the
    // account may already be compromised. The reset flow works regardless,
    // since it's requested by email, not by an existing session.
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_PASSWORD_CHANGED) ??
      `${this.webOrigin}/forgot-password`;
    return {
      subject: "Ton mot de passe Loomkeep a été modifié",
      text: `Le mot de passe de ton compte Loomkeep vient d'être changé. Si tu n'es pas à l'origine de cette action, ton compte est peut-être compromis : réinitialise immédiatement ton mot de passe.\n\n${url}`,
      html: this.wrapEmail(
        "Mot de passe modifié",
        `<p>Le mot de passe de ton compte Loomkeep vient d'être changé.</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">Si tu n'es pas à l'origine de cette action, ton compte est peut-être compromis : réinitialise immédiatement ton mot de passe.</p>
         ${this.button(url, "Réinitialiser mon mot de passe")}`,
      ),
    };
  }

  private buildNewDeviceLogin(
    deviceLabel: string,
    ip: string | null,
  ): TemplateBody {
    const ipSuffix = ip ? ` (IP ${escapeHtml(ip)})` : "";
    const ipTextSuffix = ip ? ` (IP ${ip})` : "";
    // Unlike password-changed/email-changed, the account likely isn't
    // compromised yet here — just an unrecognized device gained access — so
    // the reader is probably still logged in on their own trusted device and
    // can reach in-app settings directly.
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN) ??
      `${this.webOrigin}/app/settings#securite`;
    return {
      subject: "Nouvelle connexion à ton compte Loomkeep",
      text: `Une connexion vient d'avoir lieu sur ton compte Loomkeep depuis un appareil non reconnu : ${deviceLabel}${ipTextSuffix}. Si ce n'est pas toi, change ton mot de passe immédiatement et déconnecte les autres appareils depuis Réglages > Sécurité.\n\n${url}`,
      html: this.wrapEmail(
        "Nouvelle connexion détectée",
        `<p>Une connexion vient d'avoir lieu sur ton compte Loomkeep depuis un appareil non reconnu : <strong>${escapeHtml(deviceLabel)}</strong>${ipSuffix}.</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">Si ce n'est pas toi, change ton mot de passe immédiatement et déconnecte les autres appareils depuis Réglages > Sécurité.</p>
         ${this.button(url, "Ouvrir mes réglages de sécurité")}`,
      ),
    };
  }

  private buildEmailChangedOld(newEmail: string): TemplateBody {
    // The account's login email has already changed (and possibly the
    // password too, if compromised), so a link into the app or a reset flow
    // tied to either address can't be assumed to reach the real owner —
    // direct contact is the only reliable path here.
    const url = "mailto:contact@loomkeep.app";
    return {
      subject: "L'email de ton compte Loomkeep a changé",
      text: `L'adresse email de ton compte Loomkeep a été changée pour ${newEmail}. Si tu n'es pas à l'origine de cette action, contacte-nous immédiatement : ${url}`,
      html: this.wrapEmail(
        "Adresse email modifiée",
        `<p>L'adresse email de ton compte Loomkeep a été changée pour <strong>${newEmail}</strong>.</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">Si tu n'es pas à l'origine de cette action, ton compte est peut-être compromis : contacte-nous immédiatement.</p>
         ${this.button(url, "Nous contacter")}`,
      ),
    };
  }

  private buildEmailChangedNew(oldEmail: string): TemplateBody {
    return {
      subject: "Cette adresse est maintenant liée à ton compte Loomkeep",
      text: `Cette adresse est désormais l'email de connexion de ton compte Loomkeep (précédemment ${oldEmail}).`,
      html: this.wrapEmail(
        "Adresse email confirmée",
        `<p>Cette adresse est désormais l'email de connexion de ton compte Loomkeep (précédemment ${oldEmail}).</p>`,
      ),
    };
  }

  private buildEmailChangeCode(code: string): TemplateBody {
    return {
      subject: "Confirme ta nouvelle adresse email Loomkeep",
      text: `Voici ton code de confirmation : ${code}\n\nCe code expire dans 15 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.`,
      html: this.wrapEmail(
        "Confirme ton adresse email",
        `<p>Voici ton code de confirmation :</p>
         <p style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:${COLOR_ACCENT};text-align:center;margin:24px 0;">${code}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">Ce code expire dans 15 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`,
      ),
    };
  }

  private buildWelcome(displayName: string): TemplateBody {
    const url =
      this.umamiLink(UMAMI_LINK_SLUG_WELCOME) ?? `${this.webOrigin}/app`;
    return {
      subject: "Bienvenue sur Loomkeep",
      text: `Bienvenue ${displayName} ! Ton compte Loomkeep a été créé avec succès.\n\n${url}`,
      html: this.wrapEmail(
        "Bienvenue sur Loomkeep",
        `<p>Bienvenue <strong>${displayName}</strong> ! Ton compte Loomkeep a été créé avec succès.</p>
         ${this.button(url, "Ouvrir Loomkeep")}`,
      ),
    };
  }

  private buildVerifyEmail(token: string): TemplateBody {
    const url = `${this.webOrigin}/verify-email?token=${token}`;
    return {
      subject: "Confirme ton adresse email Loomkeep",
      text: `Confirme ton adresse email en ouvrant ce lien :\n\n${url}\n\nCe lien expire dans 24h.`,
      html: this.wrapEmail(
        "Confirme ton adresse email",
        `<p>Confirme ton adresse email en cliquant sur le bouton ci-dessous.</p>
         ${this.button(url, "Confirmer mon email")}
         <p style="color:${COLOR_MUTED};font-size:13px;">Ce lien expire dans 24h.</p>`,
      ),
    };
  }

  private buildNewEpisode(
    mediaTitle: string,
    body: string,
    path: string,
  ): TemplateBody {
    // "Voir" can't go through a Link: its destination is a different
    // episode/series page on every send, and a Link is one fixed URL — only
    // the notification-management link below (same destination every time)
    // qualifies.
    const url = `${this.webOrigin}${path}`;
    const prefsUrl =
      this.umamiLink(UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS) ??
      `${this.webOrigin}/app/settings#communications`;
    return {
      subject: `Nouvel épisode : ${mediaTitle}`,
      text: `${mediaTitle} — ${body}\n\n${url}\n\nGérer mes notifications : ${prefsUrl}`,
      html: this.wrapEmail(
        mediaTitle,
        `<p>${body}</p>
         ${this.button(url, "Voir")}
         <p style="color:${COLOR_MUTED};font-size:12px;margin-top:24px;text-align:center;"><a href="${prefsUrl}" style="color:${COLOR_MUTED};">Gérer mes notifications</a></p>`,
      ),
    };
  }

  private buildNewsletter(
    title: string,
    content: string,
    unsubscribeToken: string,
  ): TemplateBody {
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
    const { html: contentHtml, text: contentText } =
      this.renderChangelogMarkdown(content);

    return {
      subject: `Loomkeep — ${title}`,
      text: `${title}\n\n${contentText}\n\n${entryUrl}\n\nTu reçois cet email car tu es abonné aux nouveautés. Gérer mes préférences : ${prefsUrl}\nSe désinscrire : ${unsubscribeUrl}`,
      html: this.wrapEmail(
        title,
        `${contentHtml}
         ${this.button(entryUrl, "Voir sur le changelog")}
         <p style="color:${COLOR_MUTED};font-size:12px;margin-top:24px;text-align:center;">Tu reçois cet email car tu es abonné aux nouveautés · <a href="${prefsUrl}" style="color:${COLOR_MUTED};">Gérer mes préférences</a> · <a href="${unsubscribeUrl}" style="color:${COLOR_MUTED};">Se désinscrire</a></p>`,
        "Nouvelle version",
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
  private wrapEmail(title: string, bodyHtml: string, eyebrow?: string): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR_BG};padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
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
                ? `<p style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR_ACCENT};margin:0 0 8px;">${eyebrow}</p>`
                : ""
            }
            <h1 style="font-size:19px;margin:0 0 16px;color:${COLOR_ACCENT};">${title}</h1>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:${COLOR_BG};color:${COLOR_MUTED};font-size:12px;text-align:center;">
            Loomkeep — géré par toi-même
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
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
      <a href="${url}" style="display:inline-block;background:${COLOR_ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">${label}</a>
    </p>`;
  }

  private async send({ to, subject, text, html }: SendArgs): Promise<void> {
    if (!this.transporter) return;

    try {
      this.quota.record("smtp");
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
    }
  }
}
