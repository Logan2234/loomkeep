import { regionalLocale, type Locale } from "@loomkeep/shared/catalog";
import { resolveCopyLocale } from "../common/copy-locale.util";
import {
  COLOR_ACCENT,
  COLOR_BG,
  COLOR_BORDER,
  COLOR_MUTED,
  COLOR_SURFACE,
  COLOR_TEXT,
  escapeHtml,
  renderInline,
  renderQuackbackEmojiAliases,
} from "./mail-html";
import { MAIL_COPY } from "./mail.i18n";

// Umami Link slugs (see UMAMI_LINKS_BASE_URL in .env.example) — fixed
// naming, created once in the Umami dashboard, not per-deployment config.
// "Voir" (new
// episode) and "Se désinscrire" (newsletter) have no slug here: both carry a
// per-notification/per-recipient value in their destination, and a Link is
// always one fixed URL.
export const UMAMI_LINK_SLUG_PASSWORD_CHANGED = "secu-motdepasse";
export const UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN = "secu-connexion";
export const UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS = "episode-notifs";
export const UMAMI_LINK_SLUG_WELCOME = "bienvenue-app";
export const UMAMI_LINK_SLUG_NEWSLETTER_CHANGELOG = "newsletter-changelog";
export const UMAMI_LINK_SLUG_NEWSLETTER_NOTIFICATIONS = "newsletter-notifs";
export const UMAMI_LINK_SLUG_API_KEY_CREATED = "secu-api-creee";
export const UMAMI_LINK_SLUG_API_KEY_EXPIRING = "secu-api-expiration";
export const UMAMI_LINK_SLUG_API_KEY_LEAKED = "secu-api-fuite";
export const UMAMI_LINK_SLUG_SECURITY_ALERT = "secu-alerte";
export const UMAMI_LINK_SLUG_INACTIVITY = "compte-inactivite";
const UMAMI_LINK_SLUG_HEADER_SITE = "header-site";
const UMAMI_LINK_SLUG_FOOTER_SITE = "footer-site";

export type MailFooter =
  | { type: "classic" }
  | { type: "admin" }
  | { type: "moderation"; decisionId: string }
  | { type: "communications"; preferencesUrl: string }
  | { type: "unsubscribe"; preferencesUrl: string; unsubscribeUrl: string };

/** What every template needs from the instance's configuration. */
export interface MailLayoutConfig {
  /** Public web app origin, for links inside emails (reset, verify…). */
  webOrigin: string;
  /** Where contact and appeal links point. */
  supportAddress: string;
  publicApiUrl: string;
  umamiLinksBaseUrl: string | undefined;
}

/**
 * The frame every email shares — header, footer, buttons, fallback links,
 * dates — built once from the instance's configuration and handed to each
 * template (templates/*.ts).
 */
export class MailLayout {
  readonly webOrigin: string;
  readonly supportAddress: string;
  private readonly publicApiUrl: string;
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

  constructor(config: MailLayoutConfig) {
    this.webOrigin = config.webOrigin;
    this.supportAddress = config.supportAddress;
    this.publicApiUrl = config.publicApiUrl;
    this.umamiLinksBaseUrl = config.umamiLinksBaseUrl;
  }

  formatDay(locale: Locale, date: Date): string {
    return new Intl.DateTimeFormat(regionalLocale(resolveCopyLocale(locale)), {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(date);
  }

  /**
   * Renders the subset of Markdown Quackback's changelog template actually
   * produces (intro paragraph, `## ` section headings, `- `/`* ` bullet
   * lists, inline bold/italic/link spans) — not a general Markdown parser.
   * Anything outside that subset (tables, code blocks, nested lists…) falls
   * through as a plain paragraph rather than being dropped.
   */
  renderChangelogMarkdown(markdown: string): {
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
  wrapEmail(
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

  renderFooter(locale: Locale, footer: MailFooter): string {
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

  formatEventDate(locale: Locale, date: Date): string {
    return new Intl.DateTimeFormat(regionalLocale(resolveCopyLocale(locale)), {
      dateStyle: "long",
      timeStyle: "long",
      timeZone: "UTC",
    }).format(date);
  }

  eventTime(locale: Locale, date: Date): string {
    return MAIL_COPY[resolveCopyLocale(locale)].layout.eventAt(
      this.formatEventDate(locale, date),
    );
  }

  newsletterHeaders(token: string): Record<string, string> | undefined {
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

  fallbackLink(locale: Locale, url: string): string {
    const label = MAIL_COPY[resolveCopyLocale(locale)].layout.fallback;
    return `<p style="color:${COLOR_MUTED};font-size:13px;line-height:1.6;">${escapeHtml(label)}<br><a href="${escapeHtml(url)}" style="color:${COLOR_ACCENT};text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(url)}</a></p>`;
  }

  /** The Umami Link short-URL for a slug, or undefined when no base URL is configured. */
  umamiLink(slug: string): string | undefined {
    return this.umamiLinksBaseUrl
      ? `${this.umamiLinksBaseUrl}/${slug}`
      : undefined;
  }

  /** Email-safe button: a styled `<a>`, since `<button>` is unreliable across mail clients. */
  button(url: string, label: string): string {
    return `<p style="text-align:center;margin:24px 0;">
      <a class="email-button" href="${escapeHtml(url)}" style="display:inline-block;max-width:100%;box-sizing:border-box;background:${COLOR_TEXT};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.4;padding:13px 23px;border-radius:4px;">${escapeHtml(label)}</a>
    </p>`;
  }
}
