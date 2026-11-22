import type {
  AccountDeletionReason,
  AcquisitionSource,
  DigestCadence,
  Domain,
  ModerationMeasure,
  Plan,
  ProfileAccess,
  PushPlatform,
  ReviewVisibility,
  Role,
  SecurityEventType,
} from "../enums";

export const INVITATION_LABEL_MAX_LENGTH = 60;

export interface AdminUserDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  role: Role;
  /** Paid tier (docs/adr/0001-open-core-agpl.md) — set from this same panel. */
  plan: Plan;
  createdAt: string;
  /** `User.lastActiveAt` — bumped on register/login/refresh, null if never signed in. */
  lastActiveAt: string | null;
  /** Set once the inactivity reminder email has been sent, null otherwise. */
  inactivityWarningSentAt: string | null;
  /** End of a moderation suspension still in force, null otherwise. */
  suspendedUntil: string | null;
  /** When the account's self-requested deletion is due, null when none is scheduled. */
  deletionScheduledFor: string | null;
  /** The reason picked when asking for the deletion, null when none was given or none is scheduled. */
  deletionReason: AccountDeletionReason | null;
  /** Total XP (`UserScore`), 0 before any gain. */
  xp: number;
  /** The invitation this account signed up through — null for an open registration. */
  invitation: AdminUserInvitationDto | null;
  /** Works saved per domain; films, series and anime count as MEDIA. */
  libraryCounts: AdminUserLibraryCountsDto;
  enabledDomains: Domain[];
  /** Second factors set up, all three counted: an app code, an emailed code, a passkey. */
  secondFactors: AdminUserSecondFactor[];
  /** Whether the welcome tour was finished or skipped to the end. */
  onboarded: boolean;
  /** Whether the account has the app open somewhere right now. */
  online: boolean;
}

export interface AdminUserLibraryCountsDto {
  media: number;
  games: number;
  books: number;
  music: number;
}

export type AdminUserSecondFactor = "TOTP" | "EMAIL" | "WEBAUTHN";

/** The admin users table's sortable columns. */
export const ADMIN_USER_SORTS = ["created", "active", "library", "xp"] as const;
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number];

/** Everything the admin account page shows beyond the table row. */
export interface AdminUserDetailDto {
  user: AdminUserDto;
  journey: {
    onboardedAt: string | null;
    acquisitionSource: AcquisitionSource | null;
    /** Free text given with the OTHER source. */
    acquisitionSourceOther: string | null;
    acceptedTermsVersion: string | null;
    acceptedTermsAt: string | null;
    /** An age bracket such as "25-34", never the birth date itself; null when none was given. */
    ageBracket: string | null;
  };
  security: {
    passkeys: number;
    passwordless: boolean;
    recoveryCodesLeft: number;
    apiKeys: AdminUserApiKeyDto[];
    devices: AdminUserDeviceDto[];
    pushSubscriptions: AdminUserPushSubscriptionDto[];
    /** The latest security events of the account, newest first. */
    events: AdminUserSecurityEventDto[];
  };
  preferences: {
    locale: string;
    timezone: string;
    watchRegion: string | null;
    watchProviderCount: number;
    notifyEmail: DigestCadence;
    notifyPush: DigestCadence;
    newsletter: boolean;
    newsletterOptInAt: string | null;
    profileAccess: ProfileAccess;
    defaultReviewVisibility: ReviewVisibility;
    allowAdultContent: boolean;
  };
  /** The latest imports, newest first. */
  imports: AdminUserImportDto[];
  /** The latest works saved, every domain together, newest first. */
  recentAdditions: AdminUserRecentAdditionDto[];
  engagement: {
    achievements: number;
    sharedListMemberships: number;
    savedViews: number;
  };
  moderation: {
    /** Decisions taken against the account, newest first. */
    decisions: AdminUserModerationDecisionDto[];
    reportsFiled: number;
    blocking: number;
    blockedBy: number;
  };
}

export interface AdminUserApiKeyDto {
  id: string;
  name: string;
  /** The key's last characters, as shown to its owner. */
  suffix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface AdminUserDeviceDto {
  id: string;
  userAgent: string | null;
  lastSeenAt: string;
}

export interface AdminUserPushSubscriptionDto {
  id: string;
  platform: PushPlatform;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminUserSecurityEventDto {
  id: string;
  type: SecurityEventType;
  createdAt: string;
}

export interface AdminUserImportDto {
  id: string;
  sourceId: string;
  /** "SUCCESS" or "FAILURE", as `ImportRun.status` stores it. */
  status: string;
  itemCount: number;
  finishedAt: string;
}

export interface AdminUserRecentAdditionDto {
  id: string;
  title: string;
  domain: Domain;
  /** Client route to the work's page, null when the catalog id is unknown. */
  href: string | null;
  addedAt: string;
}

export interface AdminUserModerationDecisionDto {
  id: string;
  measure: ModerationMeasure;
  tosClause: string;
  decidedAt: string;
  /** Null once the deciding admin's account is gone, or for an automated decision. */
  decidedByName: string | null;
}

export interface AdminUserInvitationDto {
  label: string | null;
  /** Display name of whoever minted it — null once that account is deleted. */
  createdByName: string | null;
}

/**
 * Derived, never stored: `revoked` wins over everything, then `used` (every
 * place taken), then `expired`; a multi-use link that still has room is
 * `pending` even after its first redemption.
 */
export type AdminInvitationStatus = "pending" | "used" | "expired" | "revoked";

export interface AdminInvitationDto {
  id: string;
  /** Only this address may redeem it; null for a link shared by hand. */
  email: string | null;
  label: string | null;
  maxUses: number;
  useCount: number;
  status: AdminInvitationStatus;
  expiresAt: string;
  revokedAt: string | null;
  /** Last time the link was mailed — null if it was only ever copied. */
  emailedAt: string | null;
  createdAt: string;
  /** Display name of whoever minted it — null once that account is deleted. */
  createdByName: string | null;
  /** Accounts created through it, oldest first. */
  redeemedBy: AdminInvitationRedeemerDto[];
}

export interface AdminInvitationRedeemerDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CreateAdminInvitationRequestDto {
  /** Optional: binds the invitation to this address and mails it the link. */
  email?: string;
  label?: string;
  /** 1..INVITATION_MAX_USES. */
  maxUses: number;
  /** One of INVITATION_VALIDITY_DAYS. */
  validityDays: number;
}

/**
 * Returned on creation and renewal only: the raw link exists nowhere else
 * (the database keeps its hash), so this is the one chance to copy it.
 */
export interface AdminInvitationLinkDto {
  invitation: AdminInvitationDto;
  url: string;
  /** Whether the link was mailed — false without an email or without SMTP. */
  emailed: boolean;
}

/** Validity choices offered when minting an invitation, in days. */
export const INVITATION_VALIDITY_DAYS = [1, 7, 30] as const;

/** Upper bound on the places of one multi-use ("family") link. */
export const INVITATION_MAX_USES = 20;

/** A manual XP correction: a signed amount, never zero. */
export interface AdjustAdminUserXpRequestDto {
  amount: number;
}

/** The account's total XP once an adjustment is applied. */
export interface AdminUserXpDto {
  xp: number;
}

/** Extra server-side filter for the admin users list, on top of free-text search. */
export const ADMIN_USER_FILTERS = [
  "all",
  "admin",
  "unverified",
  "never",
  "premium",
  "deletion",
  "suspended",
  "onboarding",
  "inactive",
] as const;

export type AdminUserFilter = (typeof ADMIN_USER_FILTERS)[number];

/** Compact breakdown of the works saved in one account's libraries. */
export interface AdminUserLibraryStatsDto {
  movies: number;
  series: number;
  anime: number;
  games: number;
  books: number;
  music: number;
  total: number;
}

/** The library tiles of the admin account drawer, one per counter of the stats. */
export const ADMIN_USER_LIBRARY_KINDS = [
  "movies",
  "series",
  "anime",
  "games",
  "books",
  "music",
] as const;

export type AdminUserLibraryKind = (typeof ADMIN_USER_LIBRARY_KINDS)[number];

/** One work saved in an account's library, as the admin sees it. */
export interface AdminUserLibraryEntryDto {
  id: string;
  title: string;
  imageUrl: string | null;
  /** Client route to the work's page, null when the catalog id is unknown. */
  href: string | null;
  /** The entry's status in its own domain (EntryStatus, GameStatus, BookStatus or MusicStatus). */
  status: string;
  favorite: boolean;
  /** When the account added the work to its library. */
  addedAt: string;
}

/** Minimal account result returned by the paginated admin picker search. */
export interface AdminUserOptionDto {
  id: string;
  displayName: string;
  email: string;
}

export interface UpdateAdminUserRoleRequestDto {
  role: Role;
}

export interface AdminUserRoleDto {
  role: Role;
}

export interface UpdateAdminUserPlanRequestDto {
  plan: Plan;
}

export interface AdminUserPlanDto {
  plan: Plan;
}

export interface SecurityEventDto {
  id: string;
  type: SecurityEventType;
  /** Null once the account has since been deleted (USER_DELETED itself, or any earlier event on it). */
  userId: string | null;
  /** For LOGIN_FAILED, the string actually typed. Otherwise derived from the linked account's current email — null once the account is deleted. */
  identifier: string | null;
  /** Free-form context, e.g. the old → new email on an EMAIL_CHANGED event. */
  detail: string | null;
  userAgent: string | null;
  createdAt: string;
}
