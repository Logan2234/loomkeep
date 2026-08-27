// String-literal const object instead of a TS enum — same convention as
// enums.ts — so the values survive as plain strings across the API boundary.
// Naming: `domain.reason`, snake_case, so the i18n key is derivable
// mechanically via errorCodeToMessageKey() below.

export const ErrorCode = {
  // auth
  AuthMfaRequired: "auth.mfa_required",
  AuthAccountNotFound: "auth.account_not_found",
  AuthEmailAlreadyExists: "auth.email_already_exists",
  AuthRegistrationDisabled: "auth.registration_disabled",
  AuthAntiBotVerificationFailed: "auth.anti_bot_verification_failed",
  AuthPasswordBreached: "auth.password_breached",
  AuthInvalidVerificationToken: "auth.invalid_verification_token",
  AuthAlreadyVerified: "auth.already_verified",
  AuthInvalidCredentials: "auth.invalid_credentials",
  AuthInvalidMfaChallenge: "auth.invalid_mfa_challenge",
  AuthMfaTooManyAttempts: "auth.mfa_too_many_attempts",
  AuthMfaInvalidCode: "auth.mfa_invalid_code",
  AuthInvalidRefreshToken: "auth.invalid_refresh_token",
  AuthInvalidResetToken: "auth.invalid_reset_token",
  AuthMfaTotpNotInProgress: "auth.mfa_totp_not_in_progress",
  AuthCurrentPasswordIncorrect: "auth.current_password_incorrect",
  AuthMissingAccessToken: "auth.missing_access_token",
  AuthInvalidAccessToken: "auth.invalid_access_token",
  AuthMissingExceptParam: "auth.missing_except_param",

  // admin
  AdminCacheItemNotFound: "admin.cache_item_not_found",
  AdminCacheResyncFailed: "admin.cache_resync_failed",

  // library
  LibraryEpisodeNotAired: "library.episode_not_aired",

  // users
  UserAvatarTooLarge: "user.avatar_too_large",
  UserAvatarInvalidType: "user.avatar_invalid_type",

  // import
  ImportSimklConnectionFailed: "import.simkl_connection_failed",

  // cross-cutting — owned by the infra rather than a single domain
  ValidationFailed: "validation.failed",
  InternalError: "internal.error",

  // client-side only — never emitted by the API, thrown by apps/web's
  // request() when the fetch itself fails (see apps/web/src/lib/api/core.ts)
  NetworkOffline: "network.offline",
  NetworkTimeout: "network.timeout",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Derives the Paraglide message key for an error code, e.g.
 * "library.episode_not_aired" -> "apierr_library_episode_not_aired".
 * `apierr_` (not `error_`) because `error_*` is already used by the generic
 * error page (error_generic_body, error_generic_plaque_label...).
 */
export function errorCodeToMessageKey(code: ErrorCode): string {
  return `apierr_${code.replace(/\./g, "_")}`;
}

/**
 * Stable shape of every non-2xx API response body, built by
 * AllExceptionsFilter (apps/api/src/common/all-exceptions.filter.ts).
 * `code` is null when the throwing site hasn't been migrated to
 * AppException yet — apps/web falls back to a message keyed by `statusCode`
 * in that case (see apps/web/src/lib/api/errors.ts).
 */
export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode | null;
  params?: Record<string, string | number>;
  details?: { field: string; constraint: string }[];
  requestId?: string;
  /** Dev-facing English text: logs, Swagger, debugging. Never displayed to the user. */
  message: string;
}
