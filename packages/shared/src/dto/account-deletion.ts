import type { AccountDeletionReason } from "../enums";

/** Rows hard-deleted (cascade) when the account is removed. */
export type AccountDeletionDeletedCategory =
  | "LIBRARY"
  | "EPISODE_WATCHES"
  | "MOVIE_REWATCHES"
  | "GAMES"
  | "GAME_PLAYTHROUGHS"
  | "GAME_SESSIONS"
  | "BOOKS"
  | "BOOK_READINGS"
  | "BOOK_SESSIONS"
  | "READING_GOALS"
  | "SESSION_TIMER"
  | "MUSIC"
  | "LISTS"
  | "LIST_MEMBERSHIPS"
  | "LIST_MUTES"
  | "FOLLOWS"
  | "BLOCKS"
  | "REACTIONS"
  | "NOTIFICATIONS"
  | "ACTIVITY"
  | "PROGRESSION"
  | "SAVED_VIEWS"
  | "VISIBILITY_SETTINGS"
  | "DEVICES"
  | "API_KEYS"
  | "PASSKEYS"
  | "TWO_FACTOR"
  | "PUSH_SUBSCRIPTIONS"
  | "PENDING_REQUESTS"
  | "PREMIUM";

/** Rows detached from the account (SetNull) but kept — content survives, identity doesn't. */
export type AccountDeletionAnonymizedCategory =
  | "REVIEWS"
  | "REVIEW_REVISIONS"
  | "COMMENTS"
  | "LIST_ITEMS_ADDED"
  | "REPORTS"
  | "IMPORTS";

/** Records the instance keeps past the account, for legal or moderation reasons. */
export type AccountDeletionKeptCategory =
  "SECURITY_EVENTS" | "MODERATION_DECISIONS" | "REMOVED_CONTENT_COPIES";

interface AccountDeletionCategoryCount<T extends string> {
  category: T;
  count: number;
}

/** A list with editors: it survives, owned by its earliest editor. */
export interface AccountDeletionTransferredListDto {
  title: string;
  /** Display name of the editor who becomes its owner. */
  newOwner: string;
}

/**
 * Live preview of what deleting the current account would do, shown in the
 * confirmation modal — every category is always present, even at 0, so the
 * list reads as exhaustive rather than "whatever happened to have rows".
 */
export interface AccountDeletionSummaryDto {
  /** Signed-in sessions closed the moment the account goes. */
  sessions: number;
  deleted: AccountDeletionCategoryCount<AccountDeletionDeletedCategory>[];
  anonymized: AccountDeletionCategoryCount<AccountDeletionAnonymizedCategory>[];
  transferredLists: AccountDeletionTransferredListDto[];
  kept: AccountDeletionCategoryCount<AccountDeletionKeptCategory>[];
}

/** Days between asking for the deletion and the account actually going. */
export const ACCOUNT_DELETION_GRACE_DAYS = 14;

export interface ScheduleAccountDeletionRequestDto {
  /** Optional, recorded anonymously once the account is gone. */
  reason?: AccountDeletionReason;
}

export interface AccountDeletionScheduleDto {
  /** ISO datetime from which the daily job deletes the account. */
  scheduledFor: string;
}

/** The token from the link in the "deletion scheduled" email. */
export interface CancelAccountDeletionRequestDto {
  token: string;
}
