import type { Plan, Role, SecurityEventType } from "../enums";

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
  /** Total XP (`UserScore`), 0 before any gain. */
  xp: number;
  /** The invitation this account signed up through — null for an open registration. */
  invitation: AdminUserInvitationDto | null;
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
