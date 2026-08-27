import { m } from "$lib/paraglide/messages.js";
import { ErrorCode } from "@loomkeep/shared";
import { ApiError } from "./core";

/**
 * One message per ErrorCode. `satisfies Record<ErrorCode, ...>` is
 * load-bearing: adding a code in packages/shared without adding a message
 * here breaks the typecheck (pnpm --filter @loomkeep/web check, already run
 * by the pre-push hook) — don't weaken it to Record<string, ...> or
 * Partial<...>.
 */
const MESSAGES = {
  [ErrorCode.AuthMfaRequired]: () => m.apierr_auth_mfa_required(),
  [ErrorCode.AuthAccountNotFound]: () => m.apierr_auth_account_not_found(),
  [ErrorCode.AuthEmailAlreadyExists]: () =>
    m.apierr_auth_email_already_exists(),
  [ErrorCode.AuthRegistrationDisabled]: () =>
    m.apierr_auth_registration_disabled(),
  [ErrorCode.AuthAntiBotVerificationFailed]: () =>
    m.apierr_auth_anti_bot_verification_failed(),
  [ErrorCode.AdminCacheItemNotFound]: () =>
    m.apierr_admin_cache_item_not_found(),
  [ErrorCode.AdminCacheResyncFailed]: () =>
    m.apierr_admin_cache_resync_failed(),
  [ErrorCode.LibraryEpisodeNotAired]: () =>
    m.apierr_library_episode_not_aired(),
  [ErrorCode.UserAvatarTooLarge]: () => m.apierr_user_avatar_too_large(),
  [ErrorCode.UserAvatarInvalidType]: () => m.apierr_user_avatar_invalid_type(),
  [ErrorCode.ImportSimklConnectionFailed]: () =>
    m.apierr_import_simkl_connection_failed(),
  // Transition case: until the "Translate form validation errors" ticket
  // ships per-field UX, this key isn't actually read — resolveApiError()
  // falls back to the API's joined constraint messages instead, so no
  // screen regresses in the meantime. Still needs an entry here for the
  // `satisfies` check below.
  [ErrorCode.ValidationFailed]: () => m.apierr_validation_failed(),
  [ErrorCode.InternalError]: () => m.apierr_internal_error(),
  [ErrorCode.NetworkOffline]: () => m.apierr_network_offline(),
  [ErrorCode.NetworkTimeout]: () => m.apierr_network_timeout(),
} satisfies Record<ErrorCode, () => string>;

/**
 * Generic message per HTTP status, used whenever `code` is null (a throw
 * site not yet migrated to AppException) or unknown to this build (a newer
 * API than the deployed/cached PWA). This fallback is what keeps every
 * un-migrated API error rendering cleanly — see the
 * "Migrate API errors to error codes, domain by domain" ticket.
 */
const STATUS_MESSAGES: Record<number, () => string> = {
  400: () => m.apierr_status_400(),
  401: () => m.apierr_status_401(),
  403: () => m.apierr_status_403(),
  404: () => m.apierr_status_404(),
  409: () => m.apierr_status_409(),
  429: () => m.apierr_status_429(),
};

function statusFallback(err: ApiError): string {
  // 429 is the one status fallback with something dynamic to say: the
  // Retry-After header, parsed in core.ts's request(). Every other status
  // fallback is a static sentence.
  if (err.status === 429 && err.retryAfterSeconds !== undefined) {
    return m.apierr_status_429_retry({ seconds: err.retryAfterSeconds });
  }

  if (err.status in STATUS_MESSAGES) return STATUS_MESSAGES[err.status]();
  if (err.status >= 500 || err.status === 0) return m.apierr_status_500();
  return m.apierr_status_400();
}

/**
 * Translates an error from an API call into a user-facing string. Always
 * use this instead of reading `err.message` directly — that's the API's
 * dev-facing English text (see ApiError's doc comment), never meant for
 * display. `request()` (./core.ts) wraps every failure — including a
 * rejected fetch (offline, VPS down) — into an ApiError, so a non-ApiError
 * reaching this function is a bug in the calling code, not a real API
 * failure; it gets the same generic message as an unrecognized 5xx rather
 * than a bespoke per-call-site fallback (there used to be one — it was
 * essentially never exercised once the status/network fallbacks below
 * existed, so it was dead weight, not a real safety net).
 */
export function resolveApiError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return m.apierr_status_500();
  }

  if (err.code === ErrorCode.ValidationFailed) {
    return err.message || m.apierr_validation_failed();
  }

  if (err.code && err.code in MESSAGES) {
    return MESSAGES[err.code]();
  }

  return statusFallback(err);
}
