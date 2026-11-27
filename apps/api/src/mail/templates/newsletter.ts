import type { Locale } from "@loomkeep/shared/catalog";
import { resolveCopyLocale } from "../../common/copy-locale.util";
import { QUACKBACK_ORIGIN } from "../../common/instance-defaults";
import { renderQuackbackEmojiAliases, sanitizeHtmlUrls } from "../mail-html";
import {
  type MailLayout,
  UMAMI_LINK_SLUG_NEWSLETTER_CHANGELOG,
  UMAMI_LINK_SLUG_NEWSLETTER_NOTIFICATIONS,
} from "../mail-layout";
import { MAIL_COPY } from "../mail.i18n";
import type { TemplateBody } from "../mail.types";

// The newsletter, from a published changelog.

export function buildNewsletter(
  layout: MailLayout,

  locale: Locale,
  title: string,
  contentPreview: string,
  contentHtml: string,
  unsubscribeToken: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].newsletter;
  const entryUrl =
    layout.umamiLink(UMAMI_LINK_SLUG_NEWSLETTER_CHANGELOG) ??
    `${QUACKBACK_ORIGIN}/changelog`;
  const prefsUrl =
    layout.umamiLink(UMAMI_LINK_SLUG_NEWSLETTER_NOTIFICATIONS) ??
    `${layout.webOrigin}/app/settings/communications`;
  // Carries a per-recipient token in its query string, so — like "Voir"
  // above — it can't go through a Link (one fixed URL per Link, this one
  // is different for every recipient). Works without being logged in
  // (RGPD art. 7-3: withdrawing consent must be as easy as giving it) — a
  // single click, no session required. The settings link above stays for
  // anyone who wants finer-grained control instead of unsubscribing
  // outright.
  const unsubscribeUrl = `${layout.webOrigin}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  // renderChangelogMarkdown always drives the plain-text alt (contentPreview
  // is short but still real Markdown) and is also the HTML fallback for
  // callers with no Quackback HTML to show (the template gallery). When the
  // webhook did carry contentHtml, prefer it for the HTML body instead of
  // the 200-char preview — same pre-sanitized-by-Quackback trust boundary
  // its own email integration relies on (self-hosted, single-admin-authored
  // content, reached only through the signed webhook).
  const { html: fallbackHtml, text: contentText } =
    layout.renderChangelogMarkdown(contentPreview);
  const bodyHtml = contentHtml
    ? sanitizeHtmlUrls(renderQuackbackEmojiAliases(contentHtml))
    : fallbackHtml;

  return {
    subject: `Loomkeep — ${title}`,
    text: `${title}\n\n${contentText}\n\n${entryUrl}\n\n${copy.reason} ${copy.preferences}: ${prefsUrl}\n${copy.unsubscribe}: ${unsubscribeUrl}`,
    headers: layout.newsletterHeaders(unsubscribeToken),
    html: layout.wrapEmail(
      locale,
      title,
      `${bodyHtml}
         ${layout.button(entryUrl, copy.button)}`,
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
