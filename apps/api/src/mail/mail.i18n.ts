import type { CopyLocale } from "../common/copy-locale.util";

type ModerationVariant = {
  measure: string;
  subject: string;
};

export interface MailCopy {
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
    account: ModerationVariant;
    illegalBasis: string;
    tosBasis: (clause: string) => string;
    intro: (measure: string) => string;
    factsLabel: string;
    basisLabel: string;
    humanDecision: string;
    appeal: string;
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
}

export const MAIL_COPY = {
  fr: {
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
    },
    inactivity: {
      subject: "Ton compte Loomkeep sera supprimé pour inactivité",
      heading: "Ton compte sera bientôt supprimé",
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
      thisWeek: "cette semaine",
      oneSubject: (title) => `Nouvel épisode : ${title}`,
      oneIntro: (period) => `Un épisode t'attend ${period}.`,
      severalSubject: (count, period) => `${count} nouveaux épisodes ${period}`,
      severalIntro: (period) => `Voici ce qui sort ${period}.`,
      manySubject: (count, period) => `${count} sorties ${period}`,
      manyIntro: (count, period) =>
        `Grosse fournée : ${count} épisodes sortent ${period}.`,
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
    },
    inactivity: {
      subject: "Your Loomkeep account will be deleted due to inactivity",
      heading: "Your account will be deleted soon",
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
      thisWeek: "this week",
      oneSubject: (title) => `New episode: ${title}`,
      oneIntro: (period) => `An episode is waiting for you ${period}.`,
      severalSubject: (count, period) => `${count} new episodes ${period}`,
      severalIntro: (period) => `Here's what's coming out ${period}.`,
      manySubject: (count, period) => `${count} releases ${period}`,
      manyIntro: (count, period) =>
        `A packed lineup: ${count} episodes are coming out ${period}.`,
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
    },
    inactivity: {
      subject: "Il tuo account Loomkeep verrà eliminato per inattività",
      heading: "Il tuo account verrà eliminato a breve",
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
      thisWeek: "questa settimana",
      oneSubject: (title) => `Nuovo episodio: ${title}`,
      oneIntro: (period) => `Un episodio ti aspetta ${period}.`,
      severalSubject: (count, period) => `${count} nuovi episodi ${period}`,
      severalIntro: (period) => `Ecco cosa esce ${period}.`,
      manySubject: (count, period) => `${count} uscite ${period}`,
      manyIntro: (count, period) =>
        `Un programma fitto: ${count} episodi escono ${period}.`,
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
