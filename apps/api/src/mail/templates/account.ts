import { regionalLocale, type Locale } from "@loomkeep/shared";
import { resolveCopyLocale } from "../../common/copy-locale.util";
import {
  COLOR_ACCENT,
  COLOR_BG,
  COLOR_BORDER,
  COLOR_MUTED,
  escapeHtml,
} from "../mail-html";
import {
  UMAMI_LINK_SLUG_INACTIVITY,
  UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN,
  UMAMI_LINK_SLUG_PASSWORD_CHANGED,
  UMAMI_LINK_SLUG_SECURITY_ALERT,
  UMAMI_LINK_SLUG_WELCOME,
  type MailLayout,
} from "../mail-layout";
import { MAIL_COPY, type SecurityAlertEvent } from "../mail.i18n";
import type { TemplateBody } from "../mail.types";

// Templates of the account's own life: sign-up, sign-in, password,
// email address, second factors, deletion and inactivity.

/**
 * 24 months without a login/session refresh trigger this notice,
 * naming the exact date the account is due for automatic deletion (36
 * months of inactivity) unless the account is used again before then.
 */
export function buildInactivityWarning(
  layout: MailLayout,

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
    layout.umamiLink(UMAMI_LINK_SLUG_INACTIVITY) ?? `${layout.webOrigin}/login`;
  return {
    subject: copy.subject,
    text: `${copy.text(formattedDate)}\n\n${url}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro)}</p>
         <p>${escapeHtml(copy.policy(formattedDate))}</p>
         ${layout.button(url, copy.button)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>`,
      { template: "inactivityWarning" },
    ),
  };
}

export function buildPasswordResetLink(
  layout: MailLayout,
  locale: Locale,
  token: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].passwordReset;
  const url = `${layout.webOrigin}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    subject: copy.subject,
    text: `${copy.intro}\n\n${url}\n\n${copy.expiry}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro)}</p>
         ${layout.button(url, copy.button)}
         ${layout.fallbackLink(locale, url)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>`,
      { template: "passwordResetLink" },
    ),
  };
}

export function buildPasswordChanged(
  layout: MailLayout,

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
    layout.umamiLink(UMAMI_LINK_SLUG_PASSWORD_CHANGED) ??
    `${layout.webOrigin}/forgot-password`;
  return {
    subject: copy.subject,
    text: [
      `${copy.intro} ${copy.warning}${apiKeys ? `\n\n${apiKeys}` : ""}\n\n${url}`,
      layout.eventTime(locale, occurredAt),
    ].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(layout.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${apiKeys ? `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(apiKeys)}</p>` : ""}
         ${layout.button(url, copy.button)}`,
      { template: "passwordChanged" },
    ),
  };
}

export function buildNewDeviceLogin(
  layout: MailLayout,

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
    layout.umamiLink(UMAMI_LINK_SLUG_NEW_DEVICE_LOGIN) ??
    `${layout.webOrigin}/app/settings/security`;
  return {
    subject: copy.subject,
    text: [
      `${copy.intro(deviceLabel, ipTextSuffix)} ${copy.warning}\n\n${url}`,
      layout.eventTime(locale, occurredAt),
    ].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(layout.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(deviceLabel, ipSuffix))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "newDeviceLogin" },
    ),
  };
}

export function buildSecurityAlert(
  layout: MailLayout,

  locale: Locale,
  event: SecurityAlertEvent,
  occurredAt = new Date(),
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].securityAlert;
  const url =
    layout.umamiLink(UMAMI_LINK_SLUG_SECURITY_ALERT) ??
    `${layout.webOrigin}/app/settings/security`;
  const hint = event === "MFA_CHALLENGE_LOCKED" ? copy.lockedHint : copy.hint;
  return {
    subject: copy.subject,
    text: [
      `${copy.events[event]} ${hint}\n\n${url}`,
      layout.eventTime(locale, occurredAt),
    ].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(layout.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.events[event])}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(hint)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "securityAlert" },
    ),
  };
}

export function buildAccountDeleted(
  layout: MailLayout,

  locale: Locale,
  reason: "self" | "inactive",
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].accountDeleted;
  const intro = reason === "inactive" ? copy.inactive : copy.self;
  return {
    subject: copy.subject,
    text: `${intro}\n\n${copy.outro}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(intro)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.outro)}</p>`,
      { template: "accountDeleted" },
    ),
  };
}

export function buildAccountDeletionScheduled(
  layout: MailLayout,

  locale: Locale,
  scheduledFor: Date,
  cancelToken: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].accountDeletionScheduled;
  const date = layout.formatDay(locale, scheduledFor);
  const cancelUrl = `${layout.webOrigin}/account/cancel-deletion?token=${encodeURIComponent(cancelToken)}`;
  const exportUrl = `${layout.webOrigin}/app/settings/export`;
  return {
    subject: copy.subject(date),
    text: `${copy.intro(date)}\n\n${copy.cancelIntro}\n${cancelUrl}\n\n${copy.exportBefore}\n${exportUrl}\n\n${copy.notYou}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro(date))}</p>
         <p>${escapeHtml(copy.cancelIntro)}</p>
         ${layout.button(cancelUrl, copy.button)}
         <p>${escapeHtml(copy.exportBefore)} <a href="${exportUrl}">${escapeHtml(copy.exportLink)}</a></p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.notYou)}</p>`,
      { template: "accountDeletionScheduled" },
    ),
  };
}

export function buildAccountDeletionReminder(
  layout: MailLayout,

  locale: Locale,
  scheduledFor: Date,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].accountDeletionReminder;
  const date = layout.formatDay(locale, scheduledFor);
  const settingsUrl = `${layout.webOrigin}/app/settings/delete-account`;
  const exportUrl = `${layout.webOrigin}/app/settings/export`;
  return {
    subject: copy.subject,
    text: `${copy.intro(date)}\n\n${copy.button}: ${settingsUrl}\n${copy.exportLink}: ${exportUrl}\n\n${copy.hint}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro(date))}</p>
         ${layout.button(settingsUrl, copy.button)}
         <p><a href="${exportUrl}">${escapeHtml(copy.exportLink)}</a></p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>`,
      { template: "accountDeletionReminder" },
    ),
  };
}

export function buildAccountDeletionCancelled(
  layout: MailLayout,
  locale: Locale,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].accountDeletionCancelled;
  const url = `${layout.webOrigin}/app`;
  return {
    subject: copy.subject,
    text: `${copy.intro}\n\n${url}\n\n${copy.hint}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro)}</p>
         ${layout.button(url, copy.button)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>`,
      { template: "accountDeletionCancelled" },
    ),
  };
}

export function buildEmailChangedOld(
  layout: MailLayout,

  locale: Locale,
  newEmail: string,
  occurredAt = new Date(),
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].emailChangedOld;
  // The account's login email has already changed (and possibly the
  // password too, if compromised), so a link into the app or a reset flow
  // tied to either address can't be assumed to reach the real owner —
  // direct contact is the only reliable path here.
  const url = `mailto:${layout.supportAddress}`;
  return {
    subject: copy.subject,
    text: [
      `${copy.intro(newEmail)} ${copy.warning} ${url}`,
      layout.eventTime(locale, occurredAt),
    ].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(layout.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(newEmail))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.warning)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "emailChangedOld" },
    ),
  };
}

export function buildEmailChangedNew(
  layout: MailLayout,

  locale: Locale,
  oldEmail: string,
  occurredAt = new Date(),
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].emailChangedNew;
  return {
    subject: copy.subject,
    text: [
      `${copy.intro(oldEmail)}\n\n${copy.warning} mailto:${layout.supportAddress}`,
      layout.eventTime(locale, occurredAt),
    ].join("\n\n"),
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(layout.eventTime(locale, occurredAt))}</p>
         <p>${escapeHtml(copy.intro(oldEmail))}</p>
         <p>${escapeHtml(copy.warning)} <a href="mailto:${escapeHtml(layout.supportAddress)}" style="color:${COLOR_ACCENT};">${escapeHtml(layout.supportAddress)}</a></p>`,
      { template: "emailChangedNew" },
    ),
  };
}

export function buildEmailChangeCode(
  layout: MailLayout,
  locale: Locale,
  code: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].emailChangeCode;
  const safety = MAIL_COPY[resolveCopyLocale(locale)].layout.codeSafety;
  return {
    subject: copy.subject,
    text: `${copy.intro} ${code}\n\n${copy.expiry}\n\n${safety}`,
    html: layout.wrapEmail(
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

export function buildMfaEmailCode(
  layout: MailLayout,
  locale: Locale,
  code: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].mfaCode;
  const safety = MAIL_COPY[resolveCopyLocale(locale)].layout.codeSafety;
  return {
    subject: copy.subject,
    text: `${copy.intro} ${code}\n\n${copy.expiry}\n\n${safety}`,
    html: layout.wrapEmail(
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

export function buildWelcome(
  layout: MailLayout,
  locale: Locale,
  displayName: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].welcome;
  const url =
    layout.umamiLink(UMAMI_LINK_SLUG_WELCOME) ?? `${layout.webOrigin}/app`;
  return {
    subject: copy.subject,
    text: `${copy.intro(displayName)}\n\n${url}`,
    html: layout.wrapEmail(
      locale,
      copy.subject,
      `<p>${escapeHtml(copy.intro(displayName))}</p>
         ${layout.button(url, copy.button)}`,
      { template: "welcome" },
    ),
  };
}

export function buildVerifyEmail(
  layout: MailLayout,
  locale: Locale,
  token: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].verifyEmail;
  const url = `${layout.webOrigin}/verify-email?token=${encodeURIComponent(token)}`;
  const unexpected =
    MAIL_COPY[resolveCopyLocale(locale)].layout.unexpectedVerification;
  return {
    subject: copy.subject,
    text: `${copy.intro}\n\n${url}\n\n${copy.expiry}\n\n${unexpected}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro)}</p>
         ${layout.button(url, copy.button)}
         ${layout.fallbackLink(locale, url)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry)}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(unexpected)}</p>`,
      { template: "verifyEmail" },
    ),
  };
}

export function buildInvitation(
  layout: MailLayout,

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
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro(inviterName))}</p>
         ${layout.button(url, copy.button)}
         ${layout.fallbackLink(locale, url)}
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.expiry(formattedDate))}</p>`,
      { template: "invitation" },
    ),
  };
}
