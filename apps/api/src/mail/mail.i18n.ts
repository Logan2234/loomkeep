import type { SecurityEventType } from "@loomkeep/shared";
import type { CopyLocale } from "../common/copy-locale.util";

/** The security events that email the account's owner (see SecurityEventService). */
export const SECURITY_ALERT_EVENTS = [
  "MFA_TOTP_ENABLED",
  "MFA_TOTP_DISABLED",
  "MFA_EMAIL_ENABLED",
  "MFA_EMAIL_DISABLED",
  "MFA_WEBAUTHN_ADDED",
  "MFA_WEBAUTHN_REMOVED",
  "MFA_PASSWORDLESS_ENABLED",
  "MFA_PASSWORDLESS_DISABLED",
  "MFA_RECOVERY_CODES_REGENERATED",
  "MFA_RECOVERY_CODE_USED",
  "MFA_CHALLENGE_LOCKED",
] as const satisfies readonly SecurityEventType[];
export type SecurityAlertEvent = (typeof SECURITY_ALERT_EVENTS)[number];

type ModerationVariant = {
  measure: string;
  subject: string;
};

export interface MailCopy {
  preheaders: Record<string, string>;
  layout: {
    tagline: string;
    contact: string;
    shortContact: string;
    fallback: string;
    codeSafety: string;
    unexpectedVerification: string;
    seriesReason: string;
    newsletterReason: string;
    preferences: string;
    unsubscribe: string;
    adminReason: (host: string) => string;
    adminLink: string;
    eventAt: (date: string) => string;
    appealReason: string;
    appealLink: string;
  };
  reportsDigest: {
    subject: (count: number) => string;
    heading: string;
    sentence: (count: number) => string;
    button: string;
  };
  quotaAlert: {
    subject: (provider: string, percent: number) => string;
    heading: string;
    sentence: (
      provider: string,
      percent: number,
      count: string,
      limit: string,
    ) => string;
    exhausted: string;
    button: string;
  };
  jobAlert: {
    failedSubject: (job: string) => string;
    recoveredSubject: (job: string) => string;
    heading: string;
    failed: (job: string) => string;
    recovered: (job: string) => string;
    onlyOnce: string;
    button: string;
  };
  moderation: {
    comment: ModerationVariant;
    review: ModerationVariant;
    listRemoved: ModerationVariant;
    listEdited: ModerationVariant;
    avatar: ModerationVariant;
    bio: ModerationVariant;
    displayName: ModerationVariant;
    suspended: { measure: (until: string) => string; subject: string };
    account: ModerationVariant;
    /** Subject when one decision applies several measures at once. */
    severalSubject: string;
    /** Joins the last two measures of a list ("A, B and C"). */
    and: string;
    illegalBasis: string;
    tosBasis: (clause: string) => string;
    intro: (measure: string) => string;
    factsLabel: string;
    basisLabel: string;
    humanDecision: string;
    appeal: string;
    reference: (id: string) => string;
    decidedAt: (date: string) => string;
  };
  inactivity: {
    subject: string;
    heading: string;
    intro: string;
    policy: (date: string) => string;
    text: (date: string) => string;
    button: string;
    hint: string;
  };
  passwordReset: {
    subject: string;
    heading: string;
    intro: string;
    button: string;
    expiry: string;
  };
  passwordChanged: {
    subject: string;
    heading: string;
    intro: string;
    warning: string;
    button: string;
    /** Only when API keys are still active: they survive a password change. */
    apiKeys: (count: number) => string;
  };
  newDevice: {
    subject: string;
    heading: string;
    unknownDevice: string;
    intro: (device: string, ip: string) => string;
    warning: string;
    button: string;
  };
  apiKeyCreated: {
    subject: string;
    heading: string;
    intro: (name: string) => string;
    warning: string;
    button: string;
  };
  apiKeyExpiring: {
    subject: (name: string) => string;
    heading: string;
    intro: (name: string, date: string) => string;
    hint: string;
    button: string;
  };
  sagaSequel: {
    subject: (title: string) => string;
    heading: string;
    intro: (title: string, saga: string) => string;
    hint: string;
    button: string;
  };
  apiKeyLeaked: {
    subject: (name: string) => string;
    heading: string;
    intro: (name: string) => string;
    foundAt: string;
    hint: string;
    button: string;
  };
  emailChangedOld: {
    subject: string;
    heading: string;
    intro: (email: string) => string;
    warning: string;
    button: string;
  };
  emailChangedNew: {
    subject: string;
    heading: string;
    intro: (email: string) => string;
    warning: string;
  };
  emailChangeCode: {
    subject: string;
    heading: string;
    intro: string;
    expiry: string;
  };
  mfaCode: {
    subject: string;
    heading: string;
    intro: string;
    expiry: string;
  };
  welcome: {
    subject: string;
    intro: (name: string) => string;
    button: string;
  };
  verifyEmail: {
    subject: string;
    heading: string;
    intro: string;
    button: string;
    expiry: string;
  };
  invitation: {
    subject: (inviter: string | null) => string;
    heading: string;
    intro: (inviter: string | null) => string;
    button: string;
    expiry: (date: string) => string;
  };
  episodeDigest: {
    today: string;
    thisWeek: string;
    oneSubject: (title: string) => string;
    oneIntro: (period: string) => string;
    severalSubject: (count: number, period: string) => string;
    severalIntro: (period: string) => string;
    manySubject: (count: number, period: string) => string;
    manyIntro: (count: number, period: string) => string;
    preferences: string;
  };
  newsletter: {
    reason: string;
    preferences: string;
    unsubscribe: string;
    button: string;
    eyebrow: string;
  };
  securityAlert: {
    subject: string;
    heading: string;
    events: Record<SecurityAlertEvent, string>;
    hint: string;
    lockedHint: string;
    button: string;
  };
  accountDeleted: {
    subject: string;
    heading: string;
    self: string;
    inactive: string;
    outro: string;
  };
  adminNewUser: {
    subject: (name: string) => string;
    heading: string;
    intro: (name: string) => string;
    button: string;
  };
}

export const MAIL_COPY = {
  fr: {
    preheaders: {
      welcome: "Ton compte est prêt. Retrouve ta bibliothèque sur Loomkeep.",
      verifyEmail: "Confirme ton adresse email pour activer ton compte.",
      invitation: "Tu es invité à rejoindre cette instance Loomkeep.",
      passwordResetLink:
        "Choisis un nouveau mot de passe à l’aide de ton lien personnel.",
      passwordChanged:
        "Ton mot de passe a changé. Vérifie que cette action vient de toi.",
      emailChangedOld: "L’adresse de connexion de ton compte a changé.",
      emailChangedNew: "Cette adresse est désormais associée à ton compte.",
      emailChangeCode:
        "Utilise ton code personnel pour confirmer ta nouvelle adresse.",
      mfaEmailCode: "Utilise ton code personnel pour terminer ta connexion.",
      newsletter: "Découvre les dernières nouveautés de Loomkeep.",
      episodeDigest: "Retrouve les nouvelles sorties des séries que tu suis.",
      quotaAlert: "Un fournisseur approche de sa limite quotidienne d’appels.",
      jobAlert: "Consulte l’état d’une tâche planifiée de ton instance.",
      reportsDigest: "Des signalements attendent une décision de modération.",
      newDeviceLogin:
        "Un nouvel appareil s’est connecté. Vérifie cette activité.",
      apiKeyExpiring: "Renouvelle ta clé API avant son expiration.",
      sagaSequel: "Une suite vient d’être annoncée dans une saga que tu suis.",
      apiKeyCreated: "Une nouvelle clé API a été créée sur ton compte.",
      apiKeyLeaked: "Une clé API exposée publiquement a été révoquée.",
      securityAlert:
        "Une modification de sécurité ou une tentative de connexion concerne ton compte.",
      accountDeleted: "La suppression de ton compte Loomkeep est confirmée.",
      adminNewUser: "Un nouveau compte a été créé sur ton instance.",
      inactivityWarning:
        "Consulte la date de suppression prévue et reconnecte-toi pour conserver ton compte.",
      moderationDecision:
        "Consulte la décision, ses motifs et la procédure de contestation.",
    },
    layout: {
      tagline: "Ta bibliothèque culturelle",
      contact: "Nous contacter",
      shortContact: "Contact",
      fallback:
        "Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :",
      codeSafety:
        "Ne partage jamais ce code. Loomkeep ne te le demandera jamais par email ou par téléphone.",
      unexpectedVerification:
        "Si tu n'as pas créé de compte Loomkeep, ignore cet email.",
      seriesReason: "Tu suis ces titres ou leurs sorties sur Loomkeep.",
      newsletterReason: "Tu es abonné aux nouveautés.",
      preferences: "Préférences",
      unsubscribe: "Se désinscrire",
      adminReason: (host) => `Administration de ${host}`,
      adminLink: "Ouvrir l’administration",
      eventAt: (date) => `Date de l’événement : ${date}`,
      appealReason: "Tu peux contester cette décision.",
      appealLink: "Contacter la modération",
    },
    reportsDigest: {
      subject: (count) =>
        `${count} ${count > 1 ? "signalements" : "signalement"} en attente de modération`,
      heading: "Signalements en attente",
      sentence: (count) =>
        `${count} ${count > 1 ? "signalements" : "signalement"} en attente de modération sur Loomkeep.`,
      button: "Voir la file de modération",
    },
    quotaAlert: {
      subject: (provider, percent) =>
        `Quota ${provider} : ${percent} % utilisé aujourd'hui`,
      heading: "Quota d'un fournisseur",
      sentence: (provider, percent, count, limit) =>
        `${provider} a atteint ${percent} % de son quota quotidien : ${count} appels sur ${limit}.`,
      exhausted:
        "Les appels suivants risquent d'être refusés jusqu'au changement de jour (minuit UTC).",
      button: "Voir les services",
    },
    jobAlert: {
      failedSubject: (job) => `Échec du job ${job}`,
      recoveredSubject: (job) => `Job ${job} rétabli`,
      heading: "Jobs planifiés",
      failed: (job) => `Le job ${job} vient d'échouer :`,
      recovered: (job) => `Le job ${job} fonctionne de nouveau.`,
      onlyOnce:
        "Tu ne recevras pas d'autre e-mail pour ses échecs suivants, seulement quand il fonctionnera de nouveau.",
      button: "Voir les jobs",
    },
    moderation: {
      comment: {
        measure: "le retrait d'un de tes commentaires",
        subject: "Un de tes commentaires a été retiré",
      },
      review: {
        measure: "le retrait d'une de tes critiques",
        subject: "Une de tes critiques a été retirée",
      },
      listRemoved: {
        measure: "la suppression d'une de tes listes",
        subject: "Une de tes listes a été supprimée",
      },
      listEdited: {
        measure: "la modification d'une de tes listes",
        subject: "Une de tes listes a été modifiée",
      },
      avatar: {
        measure: "le retrait de ta photo de profil",
        subject: "Ta photo de profil a été retirée",
      },
      bio: {
        measure: "l'effacement de ta bio",
        subject: "Ta bio a été effacée",
      },
      displayName: {
        measure: "le changement de ton nom affiché",
        subject: "Ton nom affiché a été changé",
      },
      suspended: {
        measure: (until) => `la désactivation de ton compte jusqu'au ${until}`,
        subject: "Ton compte Loomkeep est désactivé",
      },
      severalSubject: "Des mesures ont été prises sur ton compte Loomkeep",
      and: "et",
      account: {
        measure: "la suppression de ton compte Loomkeep",
        subject: "Ton compte Loomkeep a été supprimé",
      },
      illegalBasis: "ce contenu nous paraît manifestement illégal",
      tosBasis: (clause) =>
        `ce contenu ou ce comportement enfreint nos Conditions Générales d'Utilisation (${clause})`,
      intro: (measure) =>
        `Nous avons pris une mesure de modération concernant ton compte : ${measure}.`,
      factsLabel: "Faits retenus",
      basisLabel: "Fondement",
      humanDecision:
        "Cette décision a été prise par un modérateur, pas par un système automatisé.",
      appeal:
        "Tu peux la contester en répondant directement à cet e-mail ou en écrivant à contact@loomkeep.app.",
      reference: (id) => `Référence de la décision : ${id}`,
      decidedAt: (date) => `Décision prise le ${date}`,
    },
    inactivity: {
      subject: "Ton compte Loomkeep sera supprimé pour inactivité",
      heading: "Suppression programmée de ton compte",
      intro: "Ton compte Loomkeep est inactif depuis 24 mois.",
      policy: (date) =>
        `Conformément à notre politique de conservation des données, il sera définitivement supprimé le ${date} si tu ne te reconnectes pas avant cette date.`,
      text: (date) =>
        `Ton compte Loomkeep est inactif depuis 24 mois. Conformément à notre politique de conservation des données, il sera définitivement supprimé le ${date} si tu ne te reconnectes pas avant cette date.\n\nPour le conserver, connecte-toi simplement une fois :`,
      button: "Me reconnecter",
      hint: "Une simple connexion suffit à annuler cette suppression.",
    },
    passwordReset: {
      subject: "Réinitialise ton mot de passe Loomkeep",
      heading: "Réinitialise ton mot de passe",
      intro:
        "Un lien de réinitialisation a été demandé pour ton compte Loomkeep.",
      button: "Réinitialiser mon mot de passe",
      expiry:
        "Ce lien expire dans 1h. Si tu n'es pas à l'origine de cette demande, ignore cet email.",
    },
    passwordChanged: {
      subject: "Ton mot de passe Loomkeep a été modifié",
      heading: "Mot de passe modifié",
      intro: "Le mot de passe de ton compte Loomkeep vient d'être changé.",
      warning:
        "Si tu n'es pas à l'origine de cette action, ton compte est peut-être compromis : réinitialise immédiatement ton mot de passe.",
      button: "Réinitialiser mon mot de passe",
      apiKeys: (count) =>
        count === 1
          ? "Ton compte a une clé API active : elle reste valable après ce changement. Si ce n'est pas toi qui as changé le mot de passe, révoque-la depuis Réglages > Intégrations."
          : `Ton compte a ${count} clés API actives : elles restent valables après ce changement. Si ce n'est pas toi qui as changé le mot de passe, révoque-les depuis Réglages > Intégrations.`,
    },
    newDevice: {
      subject: "Nouvelle connexion à ton compte Loomkeep",
      heading: "Nouvelle connexion détectée",
      unknownDevice: "Appareil inconnu",
      intro: (device, ip) =>
        `Une connexion vient d'avoir lieu sur ton compte Loomkeep depuis un appareil non reconnu : ${device}${ip}.`,
      warning:
        "Si ce n'est pas toi, change ton mot de passe immédiatement et déconnecte les autres appareils depuis Réglages > Sécurité.",
      button: "Ouvrir mes réglages de sécurité",
    },
    apiKeyCreated: {
      subject: "Nouvelle clé API sur ton compte Loomkeep",
      heading: "Clé API créée",
      intro: (name) =>
        `Une clé API nommée « ${name} » vient d'être créée sur ton compte Loomkeep. Elle permet à un outil de lire ton compte sans ton mot de passe.`,
      warning:
        "Si tu n'es pas à l'origine de cette clé, révoque-la tout de suite depuis Réglages > Intégrations, puis change ton mot de passe.",
      button: "Voir mes clés API",
    },
    apiKeyExpiring: {
      subject: (name) => `Ta clé API « ${name} » expire bientôt`,
      heading: "Clé API bientôt expirée",
      intro: (name, date) =>
        `Ta clé API « ${name} » expire le ${date}. Passé cette date, les outils qui l'utilisent n'auront plus accès à ton compte.`,
      hint: "Si tu t'en sers encore, crée une nouvelle clé et remplace-la dans tes outils. Sinon, tu n'as rien à faire.",
      button: "Gérer mes clés API",
    },
    sagaSequel: {
      subject: (title) => `Nouvelle suite annoncée : ${title}`,
      heading: "Une suite est annoncée",
      intro: (title, saga) =>
        `« ${title} » vient de rejoindre la saga ${saga}, dont tu as déjà vu une partie.`,
      hint: "Ajoute-la à ta bibliothèque pour la retrouver le moment venu.",
      button: "Voir la fiche",
    },
    apiKeyLeaked: {
      subject: (name) => `Ta clé API « ${name} » a été révoquée`,
      heading: "Clé API trouvée en public",
      intro: (name) =>
        `Ta clé API « ${name} » a été trouvée en public sur GitHub. Nous l'avons révoquée : elle ne donne plus accès à ton compte.`,
      foundAt: "Où elle a été trouvée :",
      hint: "Retire-la de là où elle a été publiée, y compris de l'historique du dépôt, puis crée une nouvelle clé pour tes outils. Si tu ne reconnais pas cette clé, change ton mot de passe.",
      button: "Gérer mes clés API",
    },
    securityAlert: {
      subject: "Activité de sécurité sur ton compte Loomkeep",
      heading: "Sécurité de ton compte",
      events: {
        MFA_TOTP_ENABLED:
          "La double authentification par application a été activée sur ton compte.",
        MFA_TOTP_DISABLED:
          "La double authentification par application a été désactivée sur ton compte.",
        MFA_EMAIL_ENABLED:
          "La double authentification par e-mail a été activée sur ton compte.",
        MFA_EMAIL_DISABLED:
          "La double authentification par e-mail a été désactivée sur ton compte.",
        MFA_WEBAUTHN_ADDED: "Une clé de sécurité a été ajoutée à ton compte.",
        MFA_WEBAUTHN_REMOVED:
          "Une clé de sécurité a été retirée de ton compte.",
        MFA_PASSWORDLESS_ENABLED:
          "La connexion sans mot de passe a été activée sur ton compte.",
        MFA_PASSWORDLESS_DISABLED:
          "La connexion sans mot de passe a été désactivée sur ton compte.",
        MFA_RECOVERY_CODES_REGENERATED:
          "De nouveaux codes de secours ont été créés pour ton compte : les anciens ne fonctionnent plus.",
        MFA_RECOVERY_CODE_USED:
          "Un code de secours vient de servir à se connecter à ton compte.",
        MFA_CHALLENGE_LOCKED:
          "Quelqu'un a saisi ton mot de passe correctement, puis a échoué plusieurs fois au second facteur. La connexion a été bloquée.",
      },
      hint: "Si c'est toi, tu n'as rien à faire. Sinon, change ton mot de passe tout de suite et vérifie tes réglages de sécurité.",
      lockedHint:
        "Ton mot de passe est sans doute connu de quelqu'un d'autre : change-le tout de suite.",
      button: "Voir mes réglages de sécurité",
    },
    accountDeleted: {
      subject: "Ton compte Loomkeep a été supprimé",
      heading: "Compte supprimé",
      self: "Comme tu l'as demandé, ton compte Loomkeep et ta bibliothèque ont été supprimés.",
      inactive:
        "Ton compte Loomkeep n'avait pas servi depuis trois ans : comme annoncé, il a été supprimé avec ta bibliothèque.",
      outro:
        "Merci d'avoir utilisé Loomkeep. Tu peux recréer un compte quand tu veux.",
    },
    adminNewUser: {
      subject: (name) => `Nouvelle inscription : ${name}`,
      heading: "Nouvelle inscription",
      intro: (name) => `${name} vient de créer un compte sur ton instance.`,
      button: "Voir les comptes",
    },
    emailChangedOld: {
      subject: "L'email de ton compte Loomkeep a changé",
      heading: "Adresse email modifiée",
      intro: (email) =>
        `L'adresse email de ton compte Loomkeep a été changée pour ${email}.`,
      warning:
        "Si tu n'es pas à l'origine de cette action, ton compte est peut-être compromis : contacte-nous immédiatement.",
      button: "Nous contacter",
    },
    emailChangedNew: {
      subject: "Cette adresse est maintenant liée à ton compte Loomkeep",
      heading: "Adresse email confirmée",
      intro: (email) =>
        `Cette adresse est désormais l'email de connexion de ton compte Loomkeep (précédemment ${email}).`,
      warning:
        "Si tu n'as pas demandé ce changement ou ne reconnais pas ce compte, contacte-nous immédiatement.",
    },
    emailChangeCode: {
      subject: "Confirme ta nouvelle adresse email Loomkeep",
      heading: "Confirme ton adresse email",
      intro: "Voici ton code de confirmation :",
      expiry:
        "Ce code expire dans 15 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.",
    },
    mfaCode: {
      subject: "Ton code de connexion Loomkeep",
      heading: "Ton code de connexion",
      intro: "Voici ton code de connexion :",
      expiry:
        "Ce code expire dans 10 minutes. Si tu n'es pas à l'origine de cette tentative de connexion, ignore cet email et vérifie ton mot de passe.",
    },
    welcome: {
      subject: "Bienvenue sur Loomkeep",
      intro: (name) =>
        `Bienvenue ${name} ! Ton compte Loomkeep a été créé avec succès.`,
      button: "Ouvrir Loomkeep",
    },
    verifyEmail: {
      subject: "Confirme ton adresse email Loomkeep",
      heading: "Confirme ton adresse email",
      intro: "Confirme ton adresse email en cliquant sur le bouton ci-dessous.",
      button: "Confirmer mon email",
      expiry: "Ce lien expire dans 24h.",
    },
    invitation: {
      subject: (inviter) =>
        inviter
          ? `${inviter} t'invite sur Loomkeep`
          : "Tu es invité·e sur Loomkeep",
      heading: "Une place t'attend sur Loomkeep",
      intro: (inviter) =>
        `${inviter ? `${inviter} t'invite` : "Tu es invité·e"} à rejoindre Loomkeep pour suivre tes séries, films, animés, jeux, livres et albums. Crée ton compte avec le bouton ci-dessous.`,
      button: "Créer mon compte",
      expiry: (date) =>
        `Cette invitation est valable jusqu'au ${date}. Si tu ne t'attendais pas à la recevoir, ignore simplement cet email.`,
    },
    episodeDigest: {
      today: "aujourd'hui",
      thisWeek: "ces 7 derniers jours",
      oneSubject: (title) => `Nouvelle sortie : ${title}`,
      oneIntro: (period) => `Une nouvelle sortie t'attend ${period}.`,
      severalSubject: (count, period) => `${count} nouvelles sorties ${period}`,
      severalIntro: (period) => `Voici ce qui est sorti ${period}.`,
      manySubject: (count, period) => `${count} sorties ${period}`,
      manyIntro: (count, period) =>
        `Grosse fournée : ${count} nouvelles sorties ${period}.`,
      preferences: "Gérer mes notifications",
    },
    newsletter: {
      reason: "Tu reçois cet email car tu es abonné aux nouveautés.",
      preferences: "Gérer mes préférences",
      unsubscribe: "Se désinscrire",
      button: "Voir sur le changelog",
      eyebrow: "Nouvelle version",
    },
  },
  en: {
    preheaders: {
      welcome: "Your account is ready. Open your library on Loomkeep.",
      verifyEmail: "Confirm your email address to activate your account.",
      invitation: "You are invited to join this Loomkeep instance.",
      passwordResetLink: "Choose a new password using your personal link.",
      passwordChanged:
        "Your password changed. Check that you requested this action.",
      emailChangedOld: "Your account’s sign-in email address has changed.",
      emailChangedNew: "This address is now associated with your account.",
      emailChangeCode:
        "Use your personal code to confirm your new email address.",
      mfaEmailCode: "Use your personal code to complete your sign-in.",
      newsletter: "Discover the latest Loomkeep news.",
      episodeDigest: "Catch up on new releases from the series you follow.",
      quotaAlert: "A provider is approaching its daily request limit.",
      jobAlert: "Check the status of a scheduled task on your instance.",
      reportsDigest: "Reports are awaiting a moderation decision.",
      newDeviceLogin: "A new device signed in. Check this activity.",
      apiKeyExpiring: "Renew your API key before it expires.",
      sagaSequel: "A sequel was just announced in a saga you follow.",
      apiKeyCreated: "A new API key was created on your account.",
      apiKeyLeaked: "A publicly exposed API key has been revoked.",
      securityAlert:
        "A security change or sign-in attempt concerns your account.",
      accountDeleted: "Your Loomkeep account deletion is confirmed.",
      adminNewUser: "A new account was created on your instance.",
      inactivityWarning:
        "Check the scheduled deletion date and sign in to keep your account.",
      moderationDecision: "Read the decision, its reasons and how to appeal.",
    },
    layout: {
      tagline: "Your cultural library",
      contact: "Contact us",
      shortContact: "Contact",
      fallback:
        "If the button does not work, copy this link into your browser:",
      codeSafety:
        "Never share this code. Loomkeep will never ask for it by email or phone.",
      unexpectedVerification:
        "If you did not create a Loomkeep account, ignore this email.",
      seriesReason: "You follow these titles or their releases on Loomkeep.",
      newsletterReason: "You are subscribed to our news.",
      preferences: "Preferences",
      unsubscribe: "Unsubscribe",
      adminReason: (host) => `Administration of ${host}`,
      adminLink: "Open administration",
      eventAt: (date) => `Event date: ${date}`,
      appealReason: "You can appeal this decision.",
      appealLink: "Contact moderation",
    },
    reportsDigest: {
      subject: (count) =>
        `${count} ${count === 1 ? "report" : "reports"} awaiting moderation`,
      heading: "Reports awaiting moderation",
      sentence: (count) =>
        `${count} ${count === 1 ? "report is" : "reports are"} awaiting moderation on Loomkeep.`,
      button: "Open the moderation queue",
    },
    quotaAlert: {
      subject: (provider, percent) =>
        `${provider} quota: ${percent}% used today`,
      heading: "Provider quota",
      sentence: (provider, percent, count, limit) =>
        `${provider} has reached ${percent}% of its daily quota: ${count} of ${limit} calls.`,
      exhausted:
        "Further calls may be refused until the day rolls over (midnight UTC).",
      button: "Open services",
    },
    jobAlert: {
      failedSubject: (job) => `Job ${job} failed`,
      recoveredSubject: (job) => `Job ${job} recovered`,
      heading: "Scheduled jobs",
      failed: (job) => `The ${job} job just failed:`,
      recovered: (job) => `The ${job} job is working again.`,
      onlyOnce:
        "You won't get another email for its next failures, only once it works again.",
      button: "Open jobs",
    },
    moderation: {
      comment: {
        measure: "the removal of one of your comments",
        subject: "One of your comments has been removed",
      },
      review: {
        measure: "the removal of one of your reviews",
        subject: "One of your reviews has been removed",
      },
      listRemoved: {
        measure: "the deletion of one of your lists",
        subject: "One of your lists has been deleted",
      },
      listEdited: {
        measure: "changes to one of your lists",
        subject: "One of your lists has been edited",
      },
      avatar: {
        measure: "the removal of your profile picture",
        subject: "Your profile picture has been removed",
      },
      bio: {
        measure: "the removal of your bio",
        subject: "Your bio has been removed",
      },
      displayName: {
        measure: "a change to your display name",
        subject: "Your display name has been changed",
      },
      suspended: {
        measure: (until) => `the suspension of your account until ${until}`,
        subject: "Your Loomkeep account is suspended",
      },
      severalSubject: "Measures have been taken on your Loomkeep account",
      and: "and",
      account: {
        measure: "the deletion of your Loomkeep account",
        subject: "Your Loomkeep account has been deleted",
      },
      illegalBasis: "we consider this content to be manifestly illegal",
      tosBasis: (clause) =>
        `this content or behavior breaches our Terms of Service (${clause})`,
      intro: (measure) =>
        `We have taken a moderation measure concerning your account: ${measure}.`,
      factsLabel: "Facts considered",
      basisLabel: "Basis",
      humanDecision:
        "This decision was made by a moderator, not by an automated system.",
      appeal:
        "You can appeal it by replying directly to this email or by writing to contact@loomkeep.app.",
      reference: (id) => `Decision reference: ${id}`,
      decidedAt: (date) => `Decision made on ${date}`,
    },
    inactivity: {
      subject: "Your Loomkeep account will be deleted due to inactivity",
      heading: "Scheduled deletion of your account",
      intro: "Your Loomkeep account has been inactive for 24 months.",
      policy: (date) =>
        `Under our data retention policy, it will be permanently deleted on ${date} unless you sign in before then.`,
      text: (date) =>
        `Your Loomkeep account has been inactive for 24 months. Under our data retention policy, it will be permanently deleted on ${date} unless you sign in before then.\n\nTo keep it, simply sign in once:`,
      button: "Sign in",
      hint: "Signing in once is enough to cancel this deletion.",
    },
    passwordReset: {
      subject: "Reset your Loomkeep password",
      heading: "Reset your password",
      intro: "A password reset link was requested for your Loomkeep account.",
      button: "Reset my password",
      expiry:
        "This link expires in 1 hour. If you did not request it, ignore this email.",
    },
    passwordChanged: {
      subject: "Your Loomkeep password was changed",
      heading: "Password changed",
      intro: "The password for your Loomkeep account was just changed.",
      warning:
        "If you did not do this, your account may be compromised: reset your password immediately.",
      button: "Reset my password",
      apiKeys: (count) =>
        count === 1
          ? "Your account has one active API key: it stays valid after this change. If you didn't change the password, revoke it from Settings > Integrations."
          : `Your account has ${count} active API keys: they stay valid after this change. If you didn't change the password, revoke them from Settings > Integrations.`,
    },
    newDevice: {
      subject: "New sign-in to your Loomkeep account",
      heading: "New sign-in detected",
      unknownDevice: "Unknown device",
      intro: (device, ip) =>
        `A sign-in to your Loomkeep account just occurred from an unrecognized device: ${device}${ip}.`,
      warning:
        "If this wasn't you, change your password immediately and sign out other devices from Settings > Security.",
      button: "Open security settings",
    },
    apiKeyCreated: {
      subject: "New API key on your Loomkeep account",
      heading: "API key created",
      intro: (name) =>
        `An API key named "${name}" was just created on your Loomkeep account. It lets a tool read your account without your password.`,
      warning:
        "If you did not create this key, revoke it right away from Settings > Integrations, then change your password.",
      button: "View my API keys",
    },
    apiKeyExpiring: {
      subject: (name) => `Your API key "${name}" expires soon`,
      heading: "API key expiring soon",
      intro: (name, date) =>
        `Your API key "${name}" expires on ${date}. After that, the tools using it will lose access to your account.`,
      hint: "If you still use it, create a new key and swap it in your tools. Otherwise, there's nothing to do.",
      button: "Manage my API keys",
    },
    sagaSequel: {
      subject: (title) => `New sequel announced: ${title}`,
      heading: "A sequel is announced",
      intro: (title, saga) =>
        `"${title}" just joined the ${saga} saga, part of which you've already watched.`,
      hint: "Add it to your library to find it when the time comes.",
      button: "Open its page",
    },
    apiKeyLeaked: {
      subject: (name) => `Your API key "${name}" was revoked`,
      heading: "API key found in public",
      intro: (name) =>
        `Your API key "${name}" was found in public on GitHub. We revoked it: it no longer gives access to your account.`,
      foundAt: "Where it was found:",
      hint: "Remove it from where it was published, repository history included, then create a new key for your tools. If you don't recognise this key, change your password.",
      button: "Manage my API keys",
    },
    securityAlert: {
      subject: "Security activity on your Loomkeep account",
      heading: "Your account's security",
      events: {
        MFA_TOTP_ENABLED:
          "Two-factor authentication with an app was turned on for your account.",
        MFA_TOTP_DISABLED:
          "Two-factor authentication with an app was turned off for your account.",
        MFA_EMAIL_ENABLED:
          "Two-factor authentication by email was turned on for your account.",
        MFA_EMAIL_DISABLED:
          "Two-factor authentication by email was turned off for your account.",
        MFA_WEBAUTHN_ADDED: "A security key was added to your account.",
        MFA_WEBAUTHN_REMOVED: "A security key was removed from your account.",
        MFA_PASSWORDLESS_ENABLED:
          "Passwordless sign-in was turned on for your account.",
        MFA_PASSWORDLESS_DISABLED:
          "Passwordless sign-in was turned off for your account.",
        MFA_RECOVERY_CODES_REGENERATED:
          "New recovery codes were created for your account: the old ones no longer work.",
        MFA_RECOVERY_CODE_USED:
          "A recovery code was just used to sign in to your account.",
        MFA_CHALLENGE_LOCKED:
          "Someone entered your password correctly, then failed the second factor several times. The sign-in was blocked.",
      },
      hint: "If this was you, there's nothing to do. If not, change your password right away and check your security settings.",
      lockedHint:
        "Someone else probably knows your password: change it right away.",
      button: "Open my security settings",
    },
    accountDeleted: {
      subject: "Your Loomkeep account was deleted",
      heading: "Account deleted",
      self: "As you asked, your Loomkeep account and your library were deleted.",
      inactive:
        "Your Loomkeep account hadn't been used for three years: as announced, it was deleted along with your library.",
      outro:
        "Thanks for using Loomkeep. You can create a new account whenever you like.",
    },
    adminNewUser: {
      subject: (name) => `New account: ${name}`,
      heading: "New account",
      intro: (name) => `${name} just signed up on your instance.`,
      button: "See the accounts",
    },
    emailChangedOld: {
      subject: "Your Loomkeep account email has changed",
      heading: "Email address changed",
      intro: (email) =>
        `The email address for your Loomkeep account was changed to ${email}.`,
      warning:
        "If you did not do this, your account may be compromised: contact us immediately.",
      button: "Contact us",
    },
    emailChangedNew: {
      subject: "This address is now linked to your Loomkeep account",
      heading: "Email address confirmed",
      intro: (email) =>
        `This address is now the sign-in email for your Loomkeep account (previously ${email}).`,
      warning:
        "If you did not request this change or do not recognize this account, contact us immediately.",
    },
    emailChangeCode: {
      subject: "Confirm your new Loomkeep email address",
      heading: "Confirm your email address",
      intro: "Here is your confirmation code:",
      expiry:
        "This code expires in 15 minutes. If you did not request it, ignore this email.",
    },
    mfaCode: {
      subject: "Your Loomkeep sign-in code",
      heading: "Your sign-in code",
      intro: "Here is your sign-in code:",
      expiry:
        "This code expires in 10 minutes. If you did not attempt to sign in, ignore this email and check your password.",
    },
    welcome: {
      subject: "Welcome to Loomkeep",
      intro: (name) =>
        `Welcome ${name}! Your Loomkeep account was created successfully.`,
      button: "Open Loomkeep",
    },
    verifyEmail: {
      subject: "Confirm your Loomkeep email address",
      heading: "Confirm your email address",
      intro: "Confirm your email address by clicking the button below.",
      button: "Confirm my email",
      expiry: "This link expires in 24 hours.",
    },
    invitation: {
      subject: (inviter) =>
        inviter
          ? `${inviter} invited you to Loomkeep`
          : "You're invited to Loomkeep",
      heading: "A seat is waiting for you on Loomkeep",
      intro: (inviter) =>
        `${inviter ? `${inviter} invited you` : "You're invited"} to join Loomkeep and track your series, movies, anime, games, books and albums. Create your account with the button below.`,
      button: "Create my account",
      expiry: (date) =>
        `This invitation is valid until ${date}. If you weren't expecting it, just ignore this email.`,
    },
    episodeDigest: {
      today: "today",
      thisWeek: "in the last 7 days",
      oneSubject: (title) => `New release: ${title}`,
      oneIntro: (period) => `A new release is waiting for you ${period}.`,
      severalSubject: (count, period) => `${count} new releases ${period}`,
      severalIntro: (period) => `Here's what came out ${period}.`,
      manySubject: (count, period) => `${count} releases ${period}`,
      manyIntro: (count, period) =>
        `A packed lineup: ${count} new releases ${period}.`,
      preferences: "Manage my notifications",
    },
    newsletter: {
      reason: "You are receiving this email because you subscribed to updates.",
      preferences: "Manage my preferences",
      unsubscribe: "Unsubscribe",
      button: "View the changelog",
      eyebrow: "New version",
    },
  },
  it: {
    preheaders: {
      welcome: "Il tuo account è pronto. Apri la tua biblioteca su Loomkeep.",
      verifyEmail: "Conferma il tuo indirizzo email per attivare l’account.",
      invitation: "Sei invitato a unirti a questa istanza Loomkeep.",
      passwordResetLink:
        "Scegli una nuova password usando il tuo link personale.",
      passwordChanged:
        "La tua password è cambiata. Verifica di aver richiesto questa azione.",
      emailChangedOld:
        "L’indirizzo email di accesso del tuo account è cambiato.",
      emailChangedNew: "Questo indirizzo è ora associato al tuo account.",
      emailChangeCode:
        "Usa il tuo codice personale per confermare il nuovo indirizzo email.",
      mfaEmailCode: "Usa il tuo codice personale per completare l’accesso.",
      newsletter: "Scopri le ultime novità di Loomkeep.",
      episodeDigest: "Scopri le nuove uscite delle serie che segui.",
      quotaAlert:
        "Un fornitore si sta avvicinando al limite giornaliero di richieste.",
      jobAlert:
        "Controlla lo stato di un’attività pianificata della tua istanza.",
      reportsDigest:
        "Alcune segnalazioni attendono una decisione di moderazione.",
      newDeviceLogin:
        "Un nuovo dispositivo ha effettuato l’accesso. Verifica questa attività.",
      apiKeyExpiring: "Rinnova la tua chiave API prima della scadenza.",
      sagaSequel: "È appena stato annunciato un seguito di una saga che segui.",
      apiKeyCreated: "È stata creata una nuova chiave API sul tuo account.",
      apiKeyLeaked: "Una chiave API esposta pubblicamente è stata revocata.",
      securityAlert:
        "Una modifica di sicurezza o un tentativo di accesso riguarda il tuo account.",
      accountDeleted: "L’eliminazione del tuo account Loomkeep è confermata.",
      adminNewUser: "È stato creato un nuovo account sulla tua istanza.",
      inactivityWarning:
        "Controlla la data di eliminazione prevista e accedi per conservare l’account.",
      moderationDecision: "Leggi la decisione, i motivi e come contestarla.",
    },
    layout: {
      tagline: "La tua biblioteca culturale",
      contact: "Contattaci",
      shortContact: "Contatti",
      fallback: "Se il pulsante non funziona, copia questo link nel browser:",
      codeSafety:
        "Non condividere mai questo codice. Loomkeep non te lo chiederà mai via email o telefono.",
      unexpectedVerification:
        "Se non hai creato un account Loomkeep, ignora questa email.",
      seriesReason: "Segui questi titoli o le loro uscite su Loomkeep.",
      newsletterReason: "Sei iscritto alle novità.",
      preferences: "Preferenze",
      unsubscribe: "Annulla l’iscrizione",
      adminReason: (host) => `Amministrazione di ${host}`,
      adminLink: "Apri l’amministrazione",
      eventAt: (date) => `Data dell’evento: ${date}`,
      appealReason: "Puoi contestare questa decisione.",
      appealLink: "Contatta la moderazione",
    },
    reportsDigest: {
      subject: (count) =>
        `${count} ${count === 1 ? "segnalazione" : "segnalazioni"} in attesa di moderazione`,
      heading: "Segnalazioni in attesa di moderazione",
      sentence: (count) =>
        `${count} ${count === 1 ? "segnalazione è" : "segnalazioni sono"} in attesa di moderazione su Loomkeep.`,
      button: "Apri la coda di moderazione",
    },
    quotaAlert: {
      subject: (provider, percent) =>
        `Quota ${provider}: ${percent}% usato oggi`,
      heading: "Quota del fornitore",
      sentence: (provider, percent, count, limit) =>
        `${provider} ha raggiunto il ${percent}% della sua quota giornaliera: ${count} chiamate su ${limit}.`,
      exhausted:
        "Le prossime chiamate potrebbero essere rifiutate fino al cambio di giorno (mezzanotte UTC).",
      button: "Apri i servizi",
    },
    jobAlert: {
      failedSubject: (job) => `Il job ${job} non è riuscito`,
      recoveredSubject: (job) => `Il job ${job} funziona di nuovo`,
      heading: "Job pianificati",
      failed: (job) => `Il job ${job} è appena fallito:`,
      recovered: (job) => `Il job ${job} funziona di nuovo.`,
      onlyOnce:
        "Non riceverai altre email per i suoi prossimi errori, solo quando tornerà a funzionare.",
      button: "Apri i job",
    },
    moderation: {
      comment: {
        measure: "la rimozione di uno dei tuoi commenti",
        subject: "Uno dei tuoi commenti è stato rimosso",
      },
      review: {
        measure: "la rimozione di una delle tue recensioni",
        subject: "Una delle tue recensioni è stata rimossa",
      },
      listRemoved: {
        measure: "l'eliminazione di una delle tue liste",
        subject: "Una delle tue liste è stata eliminata",
      },
      listEdited: {
        measure: "la modifica di una delle tue liste",
        subject: "Una delle tue liste è stata modificata",
      },
      avatar: {
        measure: "la rimozione della tua foto profilo",
        subject: "La tua foto profilo è stata rimossa",
      },
      bio: {
        measure: "la cancellazione della tua bio",
        subject: "La tua bio è stata cancellata",
      },
      displayName: {
        measure: "la modifica del tuo nome visualizzato",
        subject: "Il tuo nome visualizzato è stato modificato",
      },
      suspended: {
        measure: (until) =>
          `la disattivazione del tuo account fino al ${until}`,
        subject: "Il tuo account Loomkeep è disattivato",
      },
      severalSubject: "Sono state prese delle misure sul tuo account Loomkeep",
      and: "e",
      account: {
        measure: "l'eliminazione del tuo account Loomkeep",
        subject: "Il tuo account Loomkeep è stato eliminato",
      },
      illegalBasis: "riteniamo questo contenuto manifestamente illecito",
      tosBasis: (clause) =>
        `questo contenuto o comportamento viola i nostri Termini di servizio (${clause})`,
      intro: (measure) =>
        `Abbiamo preso una misura di moderazione riguardante il tuo account: ${measure}.`,
      factsLabel: "Fatti considerati",
      basisLabel: "Motivazione",
      humanDecision:
        "Questa decisione è stata presa da un moderatore, non da un sistema automatico.",
      appeal:
        "Puoi contestarla rispondendo direttamente a questa email o scrivendo a contact@loomkeep.app.",
      reference: (id) => `Riferimento della decisione: ${id}`,
      decidedAt: (date) => `Decisione presa il ${date}`,
    },
    inactivity: {
      subject: "Il tuo account Loomkeep verrà eliminato per inattività",
      heading: "Eliminazione programmata del tuo account",
      intro: "Il tuo account Loomkeep è inattivo da 24 mesi.",
      policy: (date) =>
        `In base alla nostra politica di conservazione dei dati, verrà eliminato definitivamente il ${date}, a meno che tu non acceda prima di allora.`,
      text: (date) =>
        `Il tuo account Loomkeep è inattivo da 24 mesi. In base alla nostra politica di conservazione dei dati, verrà eliminato definitivamente il ${date}, a meno che tu non acceda prima di allora.\n\nPer conservarlo, basta accedere una volta:`,
      button: "Accedi",
      hint: "Basta accedere una volta per annullare l'eliminazione.",
    },
    passwordReset: {
      subject: "Reimposta la tua password Loomkeep",
      heading: "Reimposta la password",
      intro:
        "È stato richiesto un link per reimpostare la password del tuo account Loomkeep.",
      button: "Reimposta la mia password",
      expiry:
        "Questo link scade tra 1 ora. Se non l'hai richiesto tu, ignora questa email.",
    },
    passwordChanged: {
      subject: "La tua password Loomkeep è stata cambiata",
      heading: "Password cambiata",
      intro: "La password del tuo account Loomkeep è appena stata cambiata.",
      warning:
        "Se non sei stato tu, il tuo account potrebbe essere compromesso: reimposta subito la password.",
      button: "Reimposta la mia password",
      apiKeys: (count) =>
        count === 1
          ? "Il tuo account ha una chiave API attiva: resta valida dopo questo cambio. Se non hai cambiato tu la password, revocala da Impostazioni > Integrazioni."
          : `Il tuo account ha ${count} chiavi API attive: restano valide dopo questo cambio. Se non hai cambiato tu la password, revocale da Impostazioni > Integrazioni.`,
    },
    newDevice: {
      subject: "Nuovo accesso al tuo account Loomkeep",
      heading: "Nuovo accesso rilevato",
      unknownDevice: "Dispositivo sconosciuto",
      intro: (device, ip) =>
        `È appena avvenuto un accesso al tuo account Loomkeep da un dispositivo non riconosciuto: ${device}${ip}.`,
      warning:
        "Se non sei stato tu, cambia subito la password e disconnetti gli altri dispositivi da Impostazioni > Sicurezza.",
      button: "Apri le impostazioni di sicurezza",
    },
    apiKeyCreated: {
      subject: "Nuova chiave API sul tuo account Loomkeep",
      heading: "Chiave API creata",
      intro: (name) =>
        `Sul tuo account Loomkeep è appena stata creata una chiave API chiamata «${name}». Permette a uno strumento di leggere il tuo account senza la tua password.`,
      warning:
        "Se non l'hai creata tu, revocala subito da Impostazioni > Integrazioni, poi cambia la password.",
      button: "Vedi le mie chiavi API",
    },
    apiKeyExpiring: {
      subject: (name) => `La tua chiave API «${name}» scade presto`,
      heading: "Chiave API in scadenza",
      intro: (name, date) =>
        `La tua chiave API «${name}» scade il ${date}. Dopo quella data, gli strumenti che la usano non avranno più accesso al tuo account.`,
      hint: "Se la usi ancora, crea una nuova chiave e sostituiscila nei tuoi strumenti. Altrimenti non devi fare nulla.",
      button: "Gestisci le mie chiavi API",
    },
    sagaSequel: {
      subject: (title) => `Nuovo seguito annunciato: ${title}`,
      heading: "È stato annunciato un seguito",
      intro: (title, saga) =>
        `«${title}» si è appena aggiunto alla saga ${saga}, di cui hai già visto una parte.`,
      hint: "Aggiungilo alla tua libreria per ritrovarlo al momento giusto.",
      button: "Apri la scheda",
    },
    apiKeyLeaked: {
      subject: (name) => `La tua chiave API «${name}» è stata revocata`,
      heading: "Chiave API trovata in pubblico",
      intro: (name) =>
        `La tua chiave API «${name}» è stata trovata in pubblico su GitHub. L'abbiamo revocata: non dà più accesso al tuo account.`,
      foundAt: "Dove è stata trovata:",
      hint: "Rimuovila da dove è stata pubblicata, compresa la cronologia del repository, poi crea una nuova chiave per i tuoi strumenti. Se non riconosci questa chiave, cambia la password.",
      button: "Gestisci le mie chiavi API",
    },
    securityAlert: {
      subject: "Attività di sicurezza sul tuo account Loomkeep",
      heading: "La sicurezza del tuo account",
      events: {
        MFA_TOTP_ENABLED:
          "L'autenticazione a due fattori tramite app è stata attivata sul tuo account.",
        MFA_TOTP_DISABLED:
          "L'autenticazione a due fattori tramite app è stata disattivata sul tuo account.",
        MFA_EMAIL_ENABLED:
          "L'autenticazione a due fattori via email è stata attivata sul tuo account.",
        MFA_EMAIL_DISABLED:
          "L'autenticazione a due fattori via email è stata disattivata sul tuo account.",
        MFA_WEBAUTHN_ADDED:
          "Una chiave di sicurezza è stata aggiunta al tuo account.",
        MFA_WEBAUTHN_REMOVED:
          "Una chiave di sicurezza è stata rimossa dal tuo account.",
        MFA_PASSWORDLESS_ENABLED:
          "L'accesso senza password è stato attivato sul tuo account.",
        MFA_PASSWORDLESS_DISABLED:
          "L'accesso senza password è stato disattivato sul tuo account.",
        MFA_RECOVERY_CODES_REGENERATED:
          "Sono stati creati nuovi codici di recupero per il tuo account: quelli vecchi non funzionano più.",
        MFA_RECOVERY_CODE_USED:
          "Un codice di recupero è appena servito per accedere al tuo account.",
        MFA_CHALLENGE_LOCKED:
          "Qualcuno ha inserito correttamente la tua password, poi ha fallito più volte il secondo fattore. L'accesso è stato bloccato.",
      },
      hint: "Se sei stato tu, non devi fare nulla. Altrimenti cambia subito la password e controlla le impostazioni di sicurezza.",
      lockedHint:
        "Probabilmente qualcun altro conosce la tua password: cambiala subito.",
      button: "Apri le impostazioni di sicurezza",
    },
    accountDeleted: {
      subject: "Il tuo account Loomkeep è stato eliminato",
      heading: "Account eliminato",
      self: "Come hai chiesto, il tuo account Loomkeep e la tua libreria sono stati eliminati.",
      inactive:
        "Il tuo account Loomkeep non veniva usato da tre anni: come annunciato, è stato eliminato insieme alla tua libreria.",
      outro:
        "Grazie per aver usato Loomkeep. Puoi creare un nuovo account quando vuoi.",
    },
    adminNewUser: {
      subject: (name) => `Nuova iscrizione: ${name}`,
      heading: "Nuova iscrizione",
      intro: (name) => `${name} ha appena creato un account sulla tua istanza.`,
      button: "Vedi gli account",
    },
    emailChangedOld: {
      subject: "L'email del tuo account Loomkeep è cambiata",
      heading: "Indirizzo email cambiato",
      intro: (email) =>
        `L'indirizzo email del tuo account Loomkeep è stato cambiato in ${email}.`,
      warning:
        "Se non sei stato tu, il tuo account potrebbe essere compromesso: contattaci subito.",
      button: "Contattaci",
    },
    emailChangedNew: {
      subject: "Questo indirizzo è ora collegato al tuo account Loomkeep",
      heading: "Indirizzo email confermato",
      intro: (email) =>
        `Questo indirizzo è ora l'email di accesso del tuo account Loomkeep (prima era ${email}).`,
      warning:
        "Se non hai richiesto questa modifica o non riconosci questo account, contattaci subito.",
    },
    emailChangeCode: {
      subject: "Conferma il tuo nuovo indirizzo email Loomkeep",
      heading: "Conferma il tuo indirizzo email",
      intro: "Ecco il tuo codice di conferma:",
      expiry:
        "Questo codice scade tra 15 minuti. Se non l'hai richiesto tu, ignora questa email.",
    },
    mfaCode: {
      subject: "Il tuo codice di accesso Loomkeep",
      heading: "Il tuo codice di accesso",
      intro: "Ecco il tuo codice di accesso:",
      expiry:
        "Questo codice scade tra 10 minuti. Se non hai provato ad accedere, ignora questa email e controlla la tua password.",
    },
    welcome: {
      subject: "Benvenuto su Loomkeep",
      intro: (name) =>
        `Benvenuto ${name}! Il tuo account Loomkeep è stato creato.`,
      button: "Apri Loomkeep",
    },
    verifyEmail: {
      subject: "Conferma il tuo indirizzo email Loomkeep",
      heading: "Conferma il tuo indirizzo email",
      intro:
        "Conferma il tuo indirizzo email cliccando sul pulsante qui sotto.",
      button: "Conferma la mia email",
      expiry: "Questo link scade tra 24 ore.",
    },
    invitation: {
      subject: (inviter) =>
        inviter
          ? `${inviter} ti ha invitato su Loomkeep`
          : "Sei invitato su Loomkeep",
      heading: "Un posto ti aspetta su Loomkeep",
      intro: (inviter) =>
        `${inviter ? `${inviter} ti ha invitato` : "Sei invitato"} a unirti a Loomkeep per seguire le tue serie, film, anime, giochi, libri e album. Crea il tuo account con il pulsante qui sotto.`,
      button: "Crea il mio account",
      expiry: (date) =>
        `Questo invito è valido fino al ${date}. Se non te lo aspettavi, ignora semplicemente questa email.`,
    },
    episodeDigest: {
      today: "oggi",
      thisWeek: "negli ultimi 7 giorni",
      oneSubject: (title) => `Nuova uscita: ${title}`,
      oneIntro: (period) => `Una nuova uscita ti aspetta ${period}.`,
      severalSubject: (count, period) => `${count} nuove uscite ${period}`,
      severalIntro: (period) => `Ecco cosa è uscito ${period}.`,
      manySubject: (count, period) => `${count} uscite ${period}`,
      manyIntro: (count, period) =>
        `Un programma fitto: ${count} nuove uscite ${period}.`,
      preferences: "Gestisci le mie notifiche",
    },
    newsletter: {
      reason: "Ricevi questa email perché ti sei iscritto agli aggiornamenti.",
      preferences: "Gestisci le mie preferenze",
      unsubscribe: "Disiscriviti",
      button: "Vedi le novità",
      eyebrow: "Nuova versione",
    },
  },
} satisfies Record<CopyLocale, MailCopy>;
