import type { SecurityEventType } from "@loomkeep/shared";

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
  "REAUTH_LOCKED",
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
    message: ModerationVariant;
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
  accountDeletionScheduled: {
    subject: (date: string) => string;
    heading: string;
    intro: (date: string) => string;
    cancelIntro: string;
    button: string;
    exportBefore: string;
    exportLink: string;
    notYou: string;
  };
  accountDeletionReminder: {
    subject: string;
    heading: string;
    intro: (date: string) => string;
    button: string;
    exportLink: string;
    hint: string;
  };
  accountDeletionCancelled: {
    subject: string;
    heading: string;
    intro: string;
    hint: string;
    button: string;
  };
  updateAvailable: {
    subject: (version: string) => string;
    heading: string;
    intro: (current: string, latest: string) => string;
    steps: string;
    button: string;
    changelog: string;
  };
  pausedReminder: {
    subject: (count: number) => string;
    heading: string;
    intro: string;
    episodesLeft: (count: number) => string;
    pagesLeft: (count: number) => string;
    pausedFor: (weeks: number, months: number) => string;
    releasedSince: (count: number) => string;
    button: string;
    reason: string;
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
