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
      listRemoved: "Une de tes listes a été supprimée",
      listEdited: "Une de tes listes a été modifiée",
      profileEdited: "Ton profil a été modifié par la modération",
      suspended: "Ton compte a été désactivé",
      other: "Une mesure a été prise sur ton compte",
    },
    /** Default name for a security key enrolled without one. */
    securityKey: "Clé de sécurité",
    releaseDigestPush: (period: DigestPeriod, titles: string[]) =>
      `${titles.length === 1 ? "Nouvelle sortie" : `${titles.length} nouvelles sorties`} ${period === "daily" ? "aujourd'hui" : "ces 7 derniers jours"} : ${[...new Set(titles)].slice(0, 3).join(", ")}.`,
    movieRelease: (type: "cinema" | "digital", region: string) =>
      `${type === "cinema" ? "Sortie au cinéma" : "Sortie numérique"} · ${region}`,
    episodeDigestPush: (period: DigestPeriod, titles: string[]) => {
      const when = period === "daily" ? "aujourd'hui" : "ces 7 derniers jours";
      const shows = [...new Set(titles)];
      const [a, b] = shows;
      if (shows.length === 1)
        return titles.length === 1
          ? [
              `Nouvel épisode de ${a}, sorti ${when}.`,
              `${a} est de retour : un épisode est sorti ${when}.`,
            ]
          : [`${titles.length} nouveaux épisodes de ${a}, sortis ${when}.`];
      if (shows.length === 2)
        return [
          `Nouveaux épisodes ${when} : ${a} et ${b}.`,
          `Double sortie ${when} : ${a} et ${b}.`,
        ];
      const others = shows.length - 2;
      return [
        `${titles.length} épisodes sont sortis ${when}.`,
        `Nouveaux épisodes ${when} : ${a}, ${b} et ${others === 1 ? "une autre série" : `${others} autres séries`}.`,
      ];
    },
    pushTitle: {
      commentReply: (actor: string) => `${actor} t'a répondu`,
      commentMention: (actor: string) => `${actor} t'a mentionné`,
    },
    listItemsAdded: (count: number, listTitle: string) =>
      `a ajouté ${count} titres à « ${listTitle} »`,
    invitationAccepted: "a rejoint Loomkeep grâce à ton invitation",
    reviewVotes: {
      title: "Ta critique est appréciée",
      body: (count: number) => `${count} votes positifs`,
    },
    importFinished: {
      title: (source: string) => `Import ${source} terminé`,
      failedTitle: (source: string) => `Import ${source} interrompu`,
      body: "Le résultat t'attend dans tes réglages.",
      failedBody:
        "Il n'a pas pu aller au bout. Les détails sont dans tes réglages.",
    },
    adminAlerts: {
      reportsPending: (count: number) => ({
        title: "Signalements en attente",
        body:
          count === 1
            ? "1 signalement attend une décision."
            : `${count} signalements attendent une décision.`,
      }),
      jobFailed: (job: string) => ({
        title: "Tâche planifiée en échec",
        body: `« ${job} » a échoué.`,
      }),
      jobRecovered: (job: string) => ({
        title: "Tâche planifiée rétablie",
        body: `« ${job} » fonctionne de nouveau.`,
      }),
      quota: (provider: string, percent: number) => ({
        title: "Quota d'un catalogue",
        body: `${provider} a atteint ${percent} % de son quota du jour.`,
      }),
      newUser: (name: string) => ({
        title: "Nouvelle inscription",
        body: `${name} vient de créer un compte.`,
      }),
    },
    apiKeys: {
      reviewTitle: "Vérifie tes clés API",
      reviewBody: (count: number) =>
        count === 1
          ? "Ton mot de passe a changé, mais ta clé API reste valable."
          : `Ton mot de passe a changé, mais tes ${count} clés API restent valables.`,
      expiringTitle: "Clé API bientôt expirée",
      expiringBody: (name: string) =>
        `Ta clé « ${name} » expire dans moins d'une semaine.`,
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
      listRemoved: "One of your lists was deleted",
      listEdited: "One of your lists was edited",
      profileEdited: "Your profile was edited by moderation",
      suspended: "Your account was suspended",
      other: "Action has been taken on your account",
    },
    securityKey: "Security key",
    releaseDigestPush: (period: DigestPeriod, titles: string[]) =>
      `${titles.length === 1 ? "New release" : `${titles.length} new releases`} ${period === "daily" ? "today" : "in the last 7 days"}: ${[...new Set(titles)].slice(0, 3).join(", ")}.`,
    movieRelease: (type: "cinema" | "digital", region: string) =>
      `${type === "cinema" ? "Cinema release" : "Digital release"} · ${region}`,
    episodeDigestPush: (period: DigestPeriod, titles: string[]) => {
      const when = period === "daily" ? "today" : "in the last 7 days";
      const shows = [...new Set(titles)];
      const [a, b] = shows;
      if (shows.length === 1)
        return titles.length === 1
          ? [
              `New episode of ${a}, out ${when}.`,
              `${a} is back: a new episode came out ${when}.`,
            ]
          : [`${titles.length} new episodes of ${a}, out ${when}.`];
      if (shows.length === 2)
        return [
          `New episodes ${when}: ${a} and ${b}.`,
          `Double release ${when}: ${a} and ${b}.`,
        ];
      const others = shows.length - 2;
      return [
        `${titles.length} episodes came out ${when}.`,
        `New episodes ${when}: ${a}, ${b} and ${others === 1 ? "one other show" : `${others} other shows`}.`,
      ];
    },
    pushTitle: {
      commentReply: (actor: string) => `${actor} replied to you`,
      commentMention: (actor: string) => `${actor} mentioned you`,
    },
    listItemsAdded: (count: number, listTitle: string) =>
      `added ${count} titles to “${listTitle}”`,
    invitationAccepted: "joined Loomkeep through your invitation",
    reviewVotes: {
      title: "People like your review",
      body: (count: number) => `${count} upvotes`,
    },
    importFinished: {
      title: (source: string) => `${source} import finished`,
      failedTitle: (source: string) => `${source} import stopped`,
      body: "The result is waiting in your settings.",
      failedBody: "It couldn't finish. The details are in your settings.",
    },
    adminAlerts: {
      reportsPending: (count: number) => ({
        title: "Reports waiting",
        body:
          count === 1
            ? "1 report is waiting for a decision."
            : `${count} reports are waiting for a decision.`,
      }),
      jobFailed: (job: string) => ({
        title: "Scheduled job failing",
        body: `“${job}” failed.`,
      }),
      jobRecovered: (job: string) => ({
        title: "Scheduled job back",
        body: `“${job}” works again.`,
      }),
      quota: (provider: string, percent: number) => ({
        title: "Catalogue quota",
        body: `${provider} reached ${percent}% of today's quota.`,
      }),
      newUser: (name: string) => ({
        title: "New account",
        body: `${name} just signed up.`,
      }),
    },
    apiKeys: {
      reviewTitle: "Check your API keys",
      reviewBody: (count: number) =>
        count === 1
          ? "Your password changed, but your API key stays valid."
          : `Your password changed, but your ${count} API keys stay valid.`,
      expiringTitle: "API key expiring soon",
      expiringBody: (name: string) =>
        `Your key "${name}" expires in less than a week.`,
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
      listRemoved: "Una delle tue liste è stata eliminata",
      listEdited: "Una delle tue liste è stata modificata",
      profileEdited: "Il tuo profilo è stato modificato dalla moderazione",
      suspended: "Il tuo account è stato disattivato",
      other: "È stata presa una misura sul tuo account",
    },
    securityKey: "Chiave di sicurezza",
    releaseDigestPush: (period: DigestPeriod, titles: string[]) =>
      `${titles.length === 1 ? "Nuova uscita" : `${titles.length} nuove uscite`} ${period === "daily" ? "oggi" : "negli ultimi 7 giorni"}: ${[...new Set(titles)].slice(0, 3).join(", ")}.`,
    movieRelease: (type: "cinema" | "digital", region: string) =>
      `${type === "cinema" ? "Uscita al cinema" : "Uscita digitale"} · ${region}`,
    episodeDigestPush: (period: DigestPeriod, titles: string[]) => {
      const when = period === "daily" ? "oggi" : "negli ultimi 7 giorni";
      const shows = [...new Set(titles)];
      const [a, b] = shows;
      if (shows.length === 1)
        return titles.length === 1
          ? [
              `Nuovo episodio di ${a}, uscito ${when}.`,
              `Torna ${a}: un nuovo episodio è uscito ${when}.`,
            ]
          : [`${titles.length} nuovi episodi di ${a}, usciti ${when}.`];
      if (shows.length === 2)
        return [
          `Nuovi episodi ${when}: ${a} e ${b}.`,
          `Doppia uscita ${when}: ${a} e ${b}.`,
        ];
      const others = shows.length - 2;
      return [
        `${titles.length} episodi sono usciti ${when}.`,
        `Nuovi episodi ${when}: ${a}, ${b} e ${others === 1 ? "un'altra serie" : `altre ${others} serie`}.`,
      ];
    },
    pushTitle: {
      commentReply: (actor: string) => `${actor} ti ha risposto`,
      commentMention: (actor: string) => `${actor} ti ha menzionato`,
    },
    listItemsAdded: (count: number, listTitle: string) =>
      `ha aggiunto ${count} titoli a “${listTitle}”`,
    invitationAccepted: "si è unito a Loomkeep grazie al tuo invito",
    reviewVotes: {
      title: "La tua recensione piace",
      body: (count: number) => `${count} voti positivi`,
    },
    importFinished: {
      title: (source: string) => `Importazione ${source} completata`,
      failedTitle: (source: string) => `Importazione ${source} interrotta`,
      body: "Il risultato ti aspetta nelle impostazioni.",
      failedBody:
        "Non è riuscita ad arrivare in fondo. I dettagli sono nelle impostazioni.",
    },
    adminAlerts: {
      reportsPending: (count: number) => ({
        title: "Segnalazioni in attesa",
        body:
          count === 1
            ? "1 segnalazione attende una decisione."
            : `${count} segnalazioni attendono una decisione.`,
      }),
      jobFailed: (job: string) => ({
        title: "Attività pianificata non riuscita",
        body: `“${job}” non è riuscita.`,
      }),
      jobRecovered: (job: string) => ({
        title: "Attività pianificata ripristinata",
        body: `“${job}” funziona di nuovo.`,
      }),
      quota: (provider: string, percent: number) => ({
        title: "Quota di un catalogo",
        body: `${provider} ha raggiunto il ${percent}% della quota giornaliera.`,
      }),
      newUser: (name: string) => ({
        title: "Nuova iscrizione",
        body: `${name} ha appena creato un account.`,
      }),
    },
    apiKeys: {
      reviewTitle: "Controlla le tue chiavi API",
      reviewBody: (count: number) =>
        count === 1
          ? "La tua password è cambiata, ma la tua chiave API resta valida."
          : `La tua password è cambiata, ma le tue ${count} chiavi API restano valide.`,
      expiringTitle: "Chiave API in scadenza",
      expiringBody: (name: string) =>
        `La tua chiave «${name}» scade tra meno di una settimana.`,
      leakedTitle: "Chiave API revocata",
      leakedBody: (name: string) =>
        `La tua chiave «${name}» è stata trovata in pubblico su GitHub. Non funziona più: creane una nuova.`,
    },
  },
} satisfies Record<CopyLocale, NotificationCopy>;

export type DigestPeriod = "daily" | "weekly";

interface PushText {
  title: string;
  body: string;
}

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
    listRemoved: string;
    listEdited: string;
    profileEdited: string;
    suspended: string;
    other: string;
  };
  securityKey: string;
  /**
   * The digest push's possible bodies, one picked at random. `titles` holds
   * one entry per episode, so a show with several appears several times.
   */
  episodeDigestPush: (period: DigestPeriod, titles: string[]) => string[];
  releaseDigestPush: (period: DigestPeriod, titles: string[]) => string;
  movieRelease: (type: "cinema" | "digital", region: string) => string;
  pushTitle: {
    commentReply: (actor: string) => string;
    commentMention: (actor: string) => string;
  };
  listItemsAdded: (count: number, listTitle: string) => string;
  invitationAccepted: string;
  reviewVotes: { title: string; body: (count: number) => string };
  importFinished: {
    title: (source: string) => string;
    failedTitle: (source: string) => string;
    body: string;
    failedBody: string;
  };
  adminAlerts: {
    reportsPending: (count: number) => PushText;
    jobFailed: (job: string) => PushText;
    jobRecovered: (job: string) => PushText;
    quota: (provider: string, percent: number) => PushText;
    newUser: (name: string) => PushText;
  };
  apiKeys: {
    reviewTitle: string;
    reviewBody: (count: number) => string;
    expiringTitle: string;
    expiringBody: (name: string) => string;
    leakedTitle: string;
    leakedBody: (name: string) => string;
  };
}

export function notificationCopy(locale: string | undefined): NotificationCopy {
  return COPY[resolveCopyLocale(locale)];
}
