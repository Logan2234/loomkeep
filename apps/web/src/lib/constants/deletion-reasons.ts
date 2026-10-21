import { m } from "#lib/paraglide/messages.js";
import {
  AccountDeletionReason,
  type AccountDeletionReason as Reason,
} from "@loomkeep/shared";

/** In the order the deletion modal offers them, "Other" last. */
export const DELETION_REASONS = Object.values(AccountDeletionReason);

export const DELETION_REASON_LABELS: Record<Reason, () => string> = {
  NOT_USING: () => m.settings_delete_account_reason_not_using(),
  MISSING_FEATURE: () => m.settings_delete_account_reason_missing_feature(),
  OTHER_SERVICE: () => m.settings_delete_account_reason_other_service(),
  PRIVACY: () => m.settings_delete_account_reason_privacy(),
  TOO_COMPLEX: () => m.settings_delete_account_reason_too_complex(),
  NEW_ACCOUNT: () => m.settings_delete_account_reason_new_account(),
  OTHER: () => m.common_other(),
};
