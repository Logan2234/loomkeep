import type { Locale } from "@loomkeep/shared";
import { resolveCopyLocale } from "../../common/copy-locale.util";
import { QUACKBACK_ORIGIN } from "../../common/instance-defaults";
import { COLOR_BORDER, escapeHtml } from "../mail-html";
import { MailLayout } from "../mail-layout";
import { MAIL_COPY } from "../mail.i18n";
import type {
  AccessibilityReport,
  ImportAlert,
  JobAlert,
  QuotaAlert,
  TemplateBody,
} from "../mail.types";

// Templates sent to the instance's administrators.

export function buildQuotaAlert(
  layout: MailLayout,
  locale: Locale,
  alert: QuotaAlert,
) {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].quotaAlert;
  const percent = Math.round(alert.threshold * 100);
  const sentence = copy.sentence(
    alert.provider,
    percent,
    alert.count.toLocaleString(locale),
    alert.limit.toLocaleString(locale),
  );
  const exhausted = alert.threshold >= 1 ? copy.exhausted : null;
  const url = `${layout.webOrigin}/app/admin/services`;
  return {
    subject: `[Admin] ${copy.subject(alert.provider, percent)}`,
    text: [sentence, exhausted, url].filter(Boolean).join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(sentence)}</p>
         ${exhausted ? `<p>${escapeHtml(exhausted)}</p>` : ""}
         ${layout.button(url, copy.button)}`,
      { template: "quotaAlert", footer: { type: "admin" } },
    ),
  };
}

export function buildJobAlert(
  layout: MailLayout,
  locale: Locale,
  alert: JobAlert,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].jobAlert;
  const url = `${layout.webOrigin}/app/admin/jobs`;
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
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(sentence)}</p>
         ${failed ? `<p><code>${escapeHtml(alert.error ?? "")}</code></p><p>${escapeHtml(copy.onlyOnce)}</p>` : ""}
         ${layout.button(url, copy.button)}`,
      { template: "jobAlert", footer: { type: "admin" } },
    ),
  };
}

export function buildImportAlert(
  layout: MailLayout,
  locale: Locale,
  alert: ImportAlert,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].importAlert;
  const url = `${layout.webOrigin}/app/admin/imports?status=FAILURE`;
  const sentence = copy.intro(alert.source);
  return {
    subject: `[Admin] ${copy.subject(alert.source)}`,
    text: [sentence, alert.error, url].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(sentence)}</p>
         <p><code>${escapeHtml(alert.error)}</code></p>
         ${layout.button(url, copy.button)}`,
      { template: "importAlert", footer: { type: "admin" } },
    ),
  };
}

export function buildReportsDigest(
  layout: MailLayout,

  locale: Locale,
  pendingCount: number,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].reportsDigest;
  const url = `${layout.webOrigin}/app/admin/reports`;
  return {
    subject: `[Admin] ${copy.subject(pendingCount)}`,
    text: `${copy.sentence(pendingCount)}\n\n${url}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${copy.sentence(pendingCount).replace(String(pendingCount), `<strong>${pendingCount}</strong>`)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "reportsDigest", footer: { type: "admin" } },
    ),
  };
}

export function buildUpdateAvailable(
  layout: MailLayout,

  locale: Locale,
  current: string,
  latest: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].updateAvailable;
  const url = `${layout.webOrigin}/app/admin/services`;
  const changelogUrl = `${QUACKBACK_ORIGIN}/changelog`;
  return {
    subject: `[Admin] ${copy.subject(latest)}`,
    text: `${copy.intro(current, latest)}\n\n${copy.steps}\n${url}\n\n${copy.changelog}: ${changelogUrl}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro(current, latest))}</p>
         <p>${escapeHtml(copy.steps)}</p>
         ${layout.button(url, copy.button)}
         <p><a href="${changelogUrl}">${escapeHtml(copy.changelog)}</a></p>`,
      { template: "updateAvailable", footer: { type: "admin" } },
    ),
  };
}

export function buildAdminNewUser(
  layout: MailLayout,
  locale: Locale,
  displayName: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].adminNewUser;
  const url = `${layout.webOrigin}/app/admin/users`;
  return {
    subject: `[Admin] ${copy.subject(displayName)}`,
    text: `${copy.intro(displayName)}\n\n${url}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro(displayName))}</p>
         ${layout.button(url, copy.button)}`,
      { template: "adminNewUser", footer: { type: "admin" } },
    ),
  };
}

export function buildAccessibilityReport(
  layout: MailLayout,
  locale: Locale,
  report: AccessibilityReport,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].accessibilityReport;
  const page = report.page ? copy.page(report.page) : null;
  const reply = report.email ? copy.replyTo : copy.anonymous;
  const paragraphs = report.message
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return {
    subject: `[Admin] ${copy.subject}`,
    text: [copy.intro, page, report.message, reply]
      .filter(Boolean)
      .join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro)}</p>
         ${page ? `<p><strong>${escapeHtml(page)}</strong></p>` : ""}
         <blockquote style="margin:0 0 16px;padding-left:12px;border-left:3px solid ${COLOR_BORDER};">${paragraphs}</blockquote>
         <p>${escapeHtml(reply)}</p>`,
      { template: "accessibilityReport", footer: { type: "admin" } },
    ),
  };
}
