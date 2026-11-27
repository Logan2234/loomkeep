import type { Locale } from "@loomkeep/shared/catalog";
import { resolveCopyLocale } from "../../common/copy-locale.util";
import {
  COLOR_ACCENT,
  COLOR_MUTED,
  COLOR_TEXT,
  escapeHtml,
} from "../mail-html";
import {
  type MailLayout,
  UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS,
} from "../mail-layout";
import { MAIL_COPY } from "../mail.i18n";
import type {
  DigestMailItem,
  PausedReminderItem,
  TemplateBody,
} from "../mail.types";

// Templates about the works someone follows: new episodes, sequels,
// paused works.

export function buildSagaSequel(
  layout: MailLayout,

  locale: Locale,
  title: string,
  saga: string,
  path: string,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].sagaSequel;
  const url = `${layout.webOrigin}${path}`;
  return {
    subject: copy.subject(title),
    text: `${copy.intro(title, saga)} ${copy.hint}\n\n${url}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro(title, saga))}</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.hint)}</p>
         ${layout.button(url, copy.button)}`,
      { template: "sagaSequel" },
    ),
  };
}

export function buildPausedReminder(
  layout: MailLayout,

  locale: Locale,
  items: PausedReminderItem[],
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].pausedReminder;
  const prefsUrl = `${layout.webOrigin}/app/settings/communications`;
  const listUrl = `${layout.webOrigin}/app/media?status=DORMANT`;
  const lines = items.map((item) => {
    const left =
      item.episodesLeft !== null && item.episodesLeft > 0
        ? copy.episodesLeft(item.episodesLeft)
        : item.pagesLeft !== null && item.pagesLeft > 0
          ? copy.pagesLeft(item.pagesLeft)
          : null;
    const paused = copy.pausedFor(
      Math.max(1, Math.round(item.pausedDays / 7)),
      Math.round(item.pausedDays / 30),
    );
    return {
      item,
      detail: left ? `${left} · ${paused}` : paused,
      released:
        item.releasedSince > 0 ? copy.releasedSince(item.releasedSince) : null,
    };
  });

  const listHtml = lines
    .map(
      ({ item, detail, released }) =>
        `<p style="margin:0 0 16px;"><a href="${layout.webOrigin}${item.url}" style="color:${COLOR_TEXT};font-weight:600;text-decoration:none;">${escapeHtml(item.title)}</a><br/><span style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(detail)}</span>${released ? `<br/><span style="font-size:13px;font-weight:600;">${escapeHtml(released)}</span>` : ""}</p>`,
    )
    .join("");
  const listText = lines
    .map(
      ({ item, detail, released }) =>
        `${item.title} — ${detail}${released ? ` · ${released}` : ""}\n${layout.webOrigin}${item.url}`,
    )
    .join("\n\n");
  const subject = copy.subject(items.length);

  return {
    subject,
    text: `${copy.intro}\n\n${listText}\n\n${copy.button}: ${listUrl}\n\n${copy.reason}\n${prefsUrl}`,
    html: layout.wrapEmail(
      locale,
      copy.heading,
      `<p>${escapeHtml(copy.intro)}</p>${listHtml}
         ${layout.button(listUrl, copy.button)}`,
      {
        template: "pausedReminder",
        footer: { type: "communications", preferencesUrl: prefsUrl },
      },
    ),
  };
}

/**
 * DRAFT WORDING — needs Logan's sign-off before any real send goes out
 * (see the notification-digest feature plan). Three tiers by item count
 * (1 / 2-4 / 5+) rather than one gabarit per event type, `period` only
 * changes the "aujourd'hui"/"ces 7 derniers jours" framing.
 */
export function buildEpisodeDigest(
  layout: MailLayout,

  locale: Locale,
  items: DigestMailItem[],
  period: "daily" | "weekly",
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].episodeDigest;
  const periodLabel = period === "daily" ? copy.today : copy.thisWeek;
  const prefsUrl =
    layout.umamiLink(UMAMI_LINK_SLUG_EPISODE_NOTIFICATIONS) ??
    `${layout.webOrigin}/app/settings/communications`;

  const listHtml = items
    .map(
      (i) =>
        `<p style="margin:0 0 16px;"><a href="${layout.webOrigin}${i.url}" style="color:${COLOR_TEXT};font-weight:600;text-decoration:none;">${escapeHtml(i.title)}</a>${i.seasonFinale ? ` <span style="color:${COLOR_ACCENT};font-size:12px;font-weight:700;">${escapeHtml(copy.seasonFinale)}</span>` : ""}<br/><span style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(i.body)}</span></p>`,
    )
    .join("");
  const listText = items
    .map(
      (i) =>
        `${i.title}${i.seasonFinale ? ` (${copy.seasonFinale})` : ""} — ${i.body}\n${layout.webOrigin}${i.url}`,
    )
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
    html: layout.wrapEmail(
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
