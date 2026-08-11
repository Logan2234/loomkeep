/** Rows hard-deleted (cascade) when the account is removed. */
export type AccountDeletionDeletedCategory =
  | "LIBRARY"
  | "WATCH_HISTORY"
  | "GAMES"
  | "BOOKS"
  | "MUSIC"
  | "LISTS"
  | "NOTIFICATIONS"
  | "FOLLOWS"
  | "BLOCKS"
  | "ACTIVITY";

/** Rows detached from the account (SetNull) but kept — content survives, identity doesn't. */
export type AccountDeletionAnonymizedCategory =
  "REVIEWS" | "COMMENTS" | "REPORTS";

interface AccountDeletionCategoryCount<T extends string> {
  category: T;
  count: number;
}

/**
 * Live preview of what deleting the current account would do, shown in the
 * confirmation modal — every category is always present, even at 0, so the
 * list reads as exhaustive rather than "whatever happened to have rows".
 */
export interface AccountDeletionSummaryDto {
  deleted: AccountDeletionCategoryCount<AccountDeletionDeletedCategory>[];
  anonymized: AccountDeletionCategoryCount<AccountDeletionAnonymizedCategory>[];
}
