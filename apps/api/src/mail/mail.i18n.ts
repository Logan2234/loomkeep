import { Locale, type Locale as LocaleCode } from "@loomkeep/shared";

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
  moderation: {
    comment: ModerationVariant;
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
    moderation: {
      comment: {
        measure: "le retrait d'un de tes commentaires",
        subject: "Un de tes commentaires a été retiré",
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
    episodeDigest: {
      today: "aujourd'hui",
      thisWeek: "cette semaine",
      oneSubject: (title) => `Nouvel épisode : ${title}`,
      oneIntro: (period) => `Un épisode t'attend ${period}.`,
      severalSubject: (count, period) =>
        `${count} nouveaux épisodes ${period}`,
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
    moderation: {
      comment: {
        measure: "the removal of one of your comments",
        subject: "One of your comments has been removed",
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
} satisfies Record<LocaleCode, MailCopy>;

export function resolveMailLocale(locale: string | undefined): LocaleCode {
  return Locale.includes(locale as LocaleCode) ? (locale as LocaleCode) : "fr";
}

export function dateLocale(locale: LocaleCode): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}
