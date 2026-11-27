import { regionalLocale, type Locale } from "@loomkeep/shared/catalog";
import { resolveCopyLocale } from "../../common/copy-locale.util";
import { COLOR_MUTED, escapeHtml } from "../mail-html";
import {
  UMAMI_LINK_SLUG_API_KEY_CREATED,
  UMAMI_LINK_SLUG_API_KEY_EXPIRING,
  UMAMI_LINK_SLUG_API_KEY_LEAKED,
  type MailLayout,
} from "../mail-layout";
import { MAIL_COPY } from "../mail.i18n";
import type { TemplateBody } from "../mail.types";

// Templates about a personal API key: created, expiring, leaked.

export function buildApiKeyCreated(
  layout: MailLayout,

  locale: Locale,
  name: string,
  occurredAt = new Date(),
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].apiKeyCreated;
  const url =
    layout.umamiLink(UMAMI_LINK_SLUG_API_KEY_CREATED) ??
    `${layout.webOrigin}/app/settings/integrations`;
  return {
    subject: copy.subject,
    text: [
      `${copy.intro(name)} ${copy.warning}

${url}`,
      layout.eventTime(locale, occurredAt),
    ].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(layout.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(name))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "apiKeyCreated" },
    ),
  };
}

export function buildApiKeyExpiring(
  layout: MailLayout,

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
    layout.umamiLink(UMAMI_LINK_SLUG_API_KEY_EXPIRING) ??
    `${layout.webOrigin}/app/settings/integrations`;
  return {
    subject: copy.subject(name),
    text: `${copy.intro(name, date)} ${copy.hint}\n\n${url}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro(name, date))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "apiKeyExpiring" },
    ),
  };
}

export function buildApiKeyLeaked(
  layout: MailLayout,

  locale: Locale,
  name: string,
  foundAt: string | null,
  occurredAt = new Date(),
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].apiKeyLeaked;
  const url =
    layout.umamiLink(UMAMI_LINK_SLUG_API_KEY_LEAKED) ??
    `${layout.webOrigin}/app/settings/integrations`;
  const where = foundAt ? `${copy.foundAt} ${foundAt}` : null;
  return {
    subject: copy.subject(name),
    text: [
      [copy.intro(name), where, copy.hint, url].filter(Boolean).join("\n\n"),
      layout.eventTime(locale, occurredAt),
    ].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(layout.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(name))}</p>
         ${where ? `<p style="overflow-wrap:anywhere;">${escapeHtml(where)}</p>` : ""}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "apiKeyLeaked" },
    ),
  };
}
