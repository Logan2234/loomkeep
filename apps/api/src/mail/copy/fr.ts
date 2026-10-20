import type { MailCopy } from "./types";

export const FR_COPY: MailCopy = {
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
    episodeDigest:
      "Retrouve les nouvelles sorties de ce que tu suis : épisodes, films et jeux.",
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
    message: {
      measure: "le retrait d'un de tes messages",
      subject: "Un de tes messages a été retiré",
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
      MFA_WEBAUTHN_REMOVED: "Une clé de sécurité a été retirée de ton compte.",
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
      REAUTH_LOCKED:
        "Sur un appareil connecté à ton compte, quelqu'un a échoué plusieurs fois à confirmer ton identité avant une action sensible. Cet appareil a été déconnecté.",
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
};
