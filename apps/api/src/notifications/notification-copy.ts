import { type CopyLocale, resolveCopyLocale } from "../common/copy-locale.util";

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
    episodeDigestPush: (period: DigestPeriod, titles: string[]) => {
      const when = period === "daily" ? "aujourd'hui" : "cette semaine";
      const [a, b] = titles;
      if (titles.length === 1)
        return [`${a} sort ${when} !`, `Ça y est, ${a} est de retour ${when}.`];
      if (titles.length === 2)
        return [
          `${a} et ${b} sortent ${when}`,
          `Double sortie ${when} : ${a} et ${b}`,
        ];
      return [
        `${titles.length} sorties t'attendent ${when}`,
        `${a}, ${b} et ${titles.length - 2} autre(s) sortent ${when}`,
      ];
    },
    apiKeys: {
      reviewTitle: "Vérifie tes clés API",
      reviewBody: (count: number) =>
        count === 1
          ? "Ton mot de passe a changé, mais ta clé API reste valable."
          : `Ton mot de passe a changé, mais tes ${count} clés API restent valables.`,
      leakedTitle: "Clé API révoquée",
      leakedBody: (name: string) =>
        `Ta clé « ${name} » a été trouvée en public sur GitHub. Elle ne fonctionne plus : crée-en une nouvelle.`,
    },
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
    episodeDigestPush: (period: DigestPeriod, titles: string[]) => {
      const when = period === "daily" ? "today" : "this week";
      const [a, b] = titles;
      if (titles.length === 1)
        return [`${a} is out ${when}!`, `There it is: ${a} is back ${when}.`];
      if (titles.length === 2)
        return [
          `${a} and ${b} are out ${when}`,
          `Double release ${when}: ${a} and ${b}`,
        ];
      return [
        `${titles.length} releases are waiting for you ${when}`,
        `${a}, ${b} and ${titles.length - 2} more are out ${when}`,
      ];
    },
    apiKeys: {
      reviewTitle: "Check your API keys",
      reviewBody: (count: number) =>
        count === 1
          ? "Your password changed, but your API key stays valid."
          : `Your password changed, but your ${count} API keys stay valid.`,
      leakedTitle: "API key revoked",
      leakedBody: (name: string) =>
        `Your key "${name}" was found in public on GitHub. It no longer works: create a new one.`,
    },
  },
  it: {
    adminTestPush:
      "Questa è una notifica di prova inviata dal pannello di amministrazione.",
    adminBroadcastPush:
      "Messaggio inviato a tutti gli account dal pannello di amministrazione.",
    reportResolution: {
      title: "La tua segnalazione è stata esaminata",
      resolved: "È stata presa una misura in seguito alla tua segnalazione.",
      dismissed: "Non è stato dato seguito alla tua segnalazione.",
    },
    follow: {
      followed: "ti segue",
      requested: "vuole seguirti",
      accepted: "ha accettato la tua richiesta",
    },
    commentReactions: {
      title: "Il tuo commento sta ricevendo reazioni",
      body: (count: number) => `${count} reazioni`,
    },
    listEditorAdded: (listTitle: string) =>
      `ti ha aggiunto come editor di “${listTitle}”`,
    listItemAdded: (itemTitle: string | null, listTitle: string) =>
      itemTitle
        ? `ha aggiunto “${itemTitle}” a “${listTitle}”`
        : `ha aggiunto un elemento a “${listTitle}”`,
    moderation: {
      commentRemoved: "Uno dei tuoi commenti è stato rimosso",
      reviewRemoved: "Una delle tue recensioni è stata rimossa",
      other: "È stata presa una misura sul tuo account",
    },
    securityKey: "Chiave di sicurezza",
    episodeDigestPush: (period: DigestPeriod, titles: string[]) => {
      const when = period === "daily" ? "oggi" : "questa settimana";
      const [a, b] = titles;
      if (titles.length === 1)
        return [`${a} esce ${when}!`, `Ci siamo: ${a} torna ${when}.`];
      if (titles.length === 2)
        return [
          `${a} e ${b} escono ${when}`,
          `Doppia uscita ${when}: ${a} e ${b}`,
        ];
      return [
        `${titles.length} uscite ti aspettano ${when}`,
        `${a}, ${b} e altri ${titles.length - 2} escono ${when}`,
      ];
    },
    apiKeys: {
      reviewTitle: "Controlla le tue chiavi API",
      reviewBody: (count: number) =>
        count === 1
          ? "La tua password è cambiata, ma la tua chiave API resta valida."
          : `La tua password è cambiata, ma le tue ${count} chiavi API restano valide.`,
      leakedTitle: "Chiave API revocata",
      leakedBody: (name: string) =>
        `La tua chiave «${name}» è stata trovata in pubblico su GitHub. Non funziona più: creane una nuova.`,
    },
  },
} satisfies Record<CopyLocale, NotificationCopy>;

export type DigestPeriod = "daily" | "weekly";

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
  /** The digest push's possible bodies; the service picks one at random. */
  episodeDigestPush: (period: DigestPeriod, titles: string[]) => string[];
  apiKeys: {
    reviewTitle: string;
    reviewBody: (count: number) => string;
    leakedTitle: string;
    leakedBody: (name: string) => string;
  };
}

export function notificationCopy(locale: string | undefined): NotificationCopy {
  return COPY[resolveCopyLocale(locale)];
}
