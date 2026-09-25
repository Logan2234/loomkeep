import { Locale, type Locale as LocaleCode } from "@loomkeep/shared";

/**
 * User-facing copy the API has to render itself, in the recipient's language.
 *
 * Notification titles and bodies are **persisted** at creation time, so they
 * cannot be translated on read the way an `ErrorCode` is: the language is
 * decided once, from the recipient's stored locale. Accepted consequence — a
 * notification written before someone switches language stays in the old one.
 *
 * Only copy with a recipient belongs here. Operator surfaces (cron run
 * summaries, security-event details) have no one to resolve a locale from.
 */
const COPY = {
  fr: {
    adminTestPush:
      "Ceci est une notification de test envoyée depuis le panel admin.",
    adminBroadcastPush:
      "Message envoyé à tous les comptes depuis le panel admin.",
    reportResolution: {
      title: "Ton signalement a été traité",
      resolved: "Une mesure a été prise suite à ton signalement.",
      dismissed: "Nous n'avons pas donné suite à ton signalement.",
    },
    follow: {
      followed: "vous suit",
      requested: "souhaite vous suivre",
      accepted: "a accepté votre demande",
    },
    commentReactions: {
      title: "Ton commentaire fait réagir",
      body: (count: number) => `${count} réactions`,
    },
    listEditorAdded: (listTitle: string) =>
      `vous a ajouté comme éditeur sur « ${listTitle} »`,
    listItemAdded: (itemTitle: string | null, listTitle: string) =>
      itemTitle
        ? `a ajouté « ${itemTitle} » à « ${listTitle} »`
        : `a ajouté un élément à « ${listTitle} »`,
    moderation: {
      commentRemoved: "Un de tes commentaires a été retiré",
      reviewRemoved: "Une de tes critiques a été retirée",
      other: "Une mesure a été prise sur ton compte",
    },
    /** Default name for a security key enrolled without one. */
    securityKey: "Clé de sécurité",
  },
  en: {
    adminTestPush: "This is a test notification sent from the admin panel.",
    adminBroadcastPush: "Message sent to all accounts from the admin panel.",
    reportResolution: {
      title: "Your report has been reviewed",
      resolved: "Action has been taken following your report.",
      dismissed: "We did not take further action on your report.",
    },
    follow: {
      followed: "follows you",
      requested: "wants to follow you",
      accepted: "accepted your request",
    },
    commentReactions: {
      title: "Your comment is getting reactions",
      body: (count: number) => `${count} reactions`,
    },
    listEditorAdded: (listTitle: string) =>
      `added you as an editor on “${listTitle}”`,
    listItemAdded: (itemTitle: string | null, listTitle: string) =>
      itemTitle
        ? `added “${itemTitle}” to “${listTitle}”`
        : `added an item to “${listTitle}”`,
    moderation: {
      commentRemoved: "One of your comments was removed",
      reviewRemoved: "One of your reviews was removed",
      other: "Action has been taken on your account",
    },
    securityKey: "Security key",
  },
} satisfies Record<LocaleCode, NotificationCopy>;

export interface NotificationCopy {
  adminTestPush: string;
  adminBroadcastPush: string;
  reportResolution: { title: string; resolved: string; dismissed: string };
  follow: { followed: string; requested: string; accepted: string };
  commentReactions: { title: string; body: (count: number) => string };
  listEditorAdded: (listTitle: string) => string;
  listItemAdded: (itemTitle: string | null, listTitle: string) => string;
  moderation: {
    commentRemoved: string;
    reviewRemoved: string;
    other: string;
  };
  securityKey: string;
}

export function notificationCopy(locale: string | undefined): NotificationCopy {
  const resolved = Locale.includes(locale as LocaleCode)
    ? (locale as LocaleCode)
    : "fr";
  return COPY[resolved];
}
