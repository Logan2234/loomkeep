/** Rows hard-deleted (cascade) when the account is removed. */
export type AccountDeletionDeletedCategory =
  | "LIBRARY"
  | "WATCH_HISTORY"
  | "GAMES"
  | "BOOKS"
  | "READING_GOALS"
  | "MUSIC"
  | "LISTS"
  | "LIST_MEMBERSHIPS"
  | "FOLLOWS"
  | "BLOCKS"
  | "REACTIONS"
  | "NOTIFICATIONS"
  | "ACTIVITY"
  | "PROGRESSION"
  | "SAVED_VIEWS"
  | "SIGN_IN";

/** Rows detached from the account (SetNull) but kept — content survives, identity doesn't. */
export type AccountDeletionAnonymizedCategory =
  "REVIEWS" | "COMMENTS" | "LIST_ITEMS_ADDED" | "REPORTS" | "IMPORTS";

/** Records the instance keeps past the account, for legal or moderation reasons. */
export type AccountDeletionKeptCategory =
  "SECURITY_EVENTS" | "MODERATION_DECISIONS";

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
