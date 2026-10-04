/**
 * How an alert reaches someone on one channel:
 * - `always`: sent whenever it happens, with no setting;
 * - `on` / `off`: a per-account setting, and its default for a new account;
 * - `cadence`: follows the episode digest's own cadence (`notifyEmail` /
 *   `notifyPush`);
 * - `opt-in`: follows a dedicated switch (`notifyNewsletter`).
 * A channel left out never carries the alert.
 */
export type AlertRule = "always" | "on" | "off" | "cadence" | "opt-in";

export const AlertGroup = {
  ACTIVITY: "activity",
  RELEASES: "releases",
  ACCOUNT: "account",
  SECURITY: "security",
  ADMIN: "admin",
  ANNOUNCEMENTS: "announcements",
} as const;
export type AlertGroup = (typeof AlertGroup)[keyof typeof AlertGroup];

export interface AlertDefinition {
  group: AlertGroup;
  bell?: "always";
  push?: AlertRule;
  email?: AlertRule;
  /** The `MailService` template that carries it, when there is one. */
  mailTemplate?: string;
  /** Who gets it, when not every account can. */
  audience?: "admins" | "social";
}

/**
 * Every alert Loomkeep sends, and on which channel: the bell (an in-app
 * `Notification` row), web push, and email. Delivery code reads it, the
 * notification settings are drawn from it, and the docs' Notifications page
 * is generated from it, so a new alert starts here. Every `NotificationType`
 * and every mail template must appear (enforced by alerts.spec.ts and the
 * API's mail spec).
 */
export const ALERTS = {
  // Activity: someone did something that concerns you.
  COMMENT_REPLY: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
    audience: "social",
  },
  COMMENT_MENTION: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
    audience: "social",
  },
  FOLLOW_REQUEST: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
    audience: "social",
  },
  FOLLOW: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
    audience: "social",
  },
  FOLLOW_ACCEPTED: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
    audience: "social",
  },
  LIST_MEMBER_ADDED: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
    audience: "social",
  },
  LIST_ITEM_ADDED: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
    audience: "social",
  },
  INVITATION_ACCEPTED: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
  },
  IMPORT_FINISHED: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    push: "off",
  },
  // Never pushed: a count going up is no reason to reach for someone's phone.
  COMMENT_REACTIONS: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    audience: "social",
  },
  REVIEW_VOTES: {
    group: AlertGroup.ACTIVITY,
    bell: "always",
    audience: "social",
  },

  // Releases: kept out of the bell, which the calendar and "Up next" cover.
  NEW_EPISODE: {
    group: AlertGroup.RELEASES,
    push: "cadence",
    email: "cadence",
    mailTemplate: "episodeDigest",
  },
  NEW_MOVIE: {
    group: AlertGroup.RELEASES,
    push: "cadence",
    email: "cadence",
    mailTemplate: "episodeDigest",
  },
  // In the bell too: nothing else surfaces an announcement, which neither
  // the calendar nor "Up next" can show before there's a date.
  SAGA_SEQUEL_ANNOUNCED: {
    group: AlertGroup.RELEASES,
    bell: "always",
    push: "on",
    email: "off",
    mailTemplate: "sagaSequel",
  },

  // Your account: things to know about, settings or not.
  MODERATION_ACTION: {
    group: AlertGroup.ACCOUNT,
    bell: "always",
    email: "always",
    mailTemplate: "moderationDecision",
  },
  REPORT_RESOLVED: {
    group: AlertGroup.ACCOUNT,
    bell: "always",
    audience: "social",
  },
  API_KEYS_REVIEW: { group: AlertGroup.ACCOUNT, bell: "always" },
  API_KEY_EXPIRING: {
    group: AlertGroup.ACCOUNT,
    bell: "always",
    email: "always",
    mailTemplate: "apiKeyExpiring",
  },
  API_KEY_LEAKED: {
    group: AlertGroup.ACCOUNT,
    bell: "always",
    email: "always",
    mailTemplate: "apiKeyLeaked",
  },
  WELCOME: {
    group: AlertGroup.ACCOUNT,
    email: "always",
    mailTemplate: "welcome",
  },
  VERIFY_EMAIL: {
    group: AlertGroup.ACCOUNT,
    email: "always",
    mailTemplate: "verifyEmail",
  },
  INVITATION: {
    group: AlertGroup.ACCOUNT,
    email: "always",
    mailTemplate: "invitation",
  },
  INACTIVITY_WARNING: {
    group: AlertGroup.ACCOUNT,
    email: "always",
    mailTemplate: "inactivityWarning",
  },
  ACCOUNT_DELETED: {
    group: AlertGroup.ACCOUNT,
    email: "always",
    mailTemplate: "accountDeleted",
  },
  NEWSLETTER: {
    group: AlertGroup.ANNOUNCEMENTS,
    email: "opt-in",
    mailTemplate: "newsletter",
  },
  // Sent from Admin › Communications to every device with push on.
  ADMIN_BROADCAST: { group: AlertGroup.ANNOUNCEMENTS, push: "always" },

  // Security: always by email, which an intruder can't dismiss the way a
  // bell entry is dismissed by reading it.
  PASSWORD_RESET: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "passwordResetLink",
  },
  PASSWORD_CHANGED: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "passwordChanged",
  },
  EMAIL_CHANGE_CODE: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "emailChangeCode",
  },
  EMAIL_CHANGED: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "emailChangedOld",
  },
  EMAIL_CHANGED_NEW_ADDRESS: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "emailChangedNew",
  },
  MFA_EMAIL_CODE: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "mfaEmailCode",
  },
  NEW_DEVICE_LOGIN: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "newDeviceLogin",
  },
  SECURITY_SETTINGS_CHANGED: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "securityAlert",
  },
  RECOVERY_CODE_USED: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "securityAlert",
  },
  SECOND_FACTOR_LOCKED: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "securityAlert",
  },
  API_KEY_CREATED: {
    group: AlertGroup.SECURITY,
    email: "always",
    mailTemplate: "apiKeyCreated",
  },

  // Administrators only.
  ADMIN_REPORTS_PENDING: {
    group: AlertGroup.ADMIN,
    email: "on",
    push: "off",
    mailTemplate: "reportsDigest",
    audience: "admins",
  },
  ADMIN_JOB_FAILED: {
    group: AlertGroup.ADMIN,
    email: "on",
    push: "off",
    mailTemplate: "jobAlert",
    audience: "admins",
  },
  ADMIN_QUOTA: {
    group: AlertGroup.ADMIN,
    email: "on",
    push: "off",
    mailTemplate: "quotaAlert",
    audience: "admins",
  },
  ADMIN_NEW_USER: {
    group: AlertGroup.ADMIN,
    email: "on",
    push: "off",
    mailTemplate: "adminNewUser",
    audience: "admins",
  },
} as const satisfies Record<string, AlertDefinition>;

export type AlertKey = keyof typeof ALERTS;

/** One account's choices, only where it moved away from the default. */
export type AlertPrefs = Partial<
  Record<AlertKey, Partial<Record<"push" | "email", boolean>>>
>;

/** Whether `channel` can be switched on and off for `key`. */
export function isAlertToggleable(
  key: AlertKey,
  channel: "push" | "email",
): boolean {
  const rule: AlertRule | undefined = (ALERTS[key] as AlertDefinition)[channel];
  return rule === "on" || rule === "off";
}

/** Whether a togglable alert goes out on `channel` for these prefs. */
export function isAlertEnabled(
  prefs: AlertPrefs | null | undefined,
  key: AlertKey,
  channel: "push" | "email",
): boolean {
  const rule: AlertRule | undefined = (ALERTS[key] as AlertDefinition)[channel];
  if (rule === "always") return true;
  if (rule !== "on" && rule !== "off") return false;
  return prefs?.[key]?.[channel] ?? rule === "on";
}

/**
 * `patch` laid over `stored`, or null when it names an alert or a channel
 * with no setting, or a value that isn't a boolean.
 */
export function mergeAlertPrefs(
  stored: AlertPrefs,
  patch: Record<string, unknown>,
): AlertPrefs | null {
  const merged: Record<string, Record<string, boolean>> = Object.fromEntries(
    Object.entries(stored).map(([key, channels]) => [key, { ...channels }]),
  );

  for (const [key, channels] of Object.entries(patch)) {
    if (!(key in ALERTS) || typeof channels !== "object" || !channels) {
      return null;
    }

    for (const [channel, value] of Object.entries(channels)) {
      if (
        (channel !== "push" && channel !== "email") ||
        !isAlertToggleable(key as AlertKey, channel) ||
        typeof value !== "boolean"
      ) {
        return null;
      }

      merged[key] = { ...merged[key], [channel]: value };
    }
  }

  return merged as AlertPrefs;
}
