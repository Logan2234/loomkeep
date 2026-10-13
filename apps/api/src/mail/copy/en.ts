import type { MailCopy } from "./types";

export const EN_COPY: MailCopy = {
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
    episodeDigest:
      "Catch up on new releases of what you follow: episodes, movies and games.",
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
    fallback: "If the button does not work, copy this link into your browser:",
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
    subject: (provider, percent) => `${provider} quota: ${percent}% used today`,
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
    message: {
      measure: "the removal of one of your messages",
      subject: "One of your messages has been removed",
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
      REAUTH_LOCKED:
        "On a device signed in to your account, someone failed several times to confirm your identity before a sensitive action. That device was signed out.",
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
};
