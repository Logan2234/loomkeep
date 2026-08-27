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

  // library — entry/replay codes are shared across media/games/books/music,
  // the four domains that each have their own *LibraryService with the same
  // ownership-check shape
  LibraryEpisodeNotAired: "library.episode_not_aired",
  LibraryCalendarUnavailable: "library.calendar_unavailable",
  LibraryEpisodeNotFound: "library.episode_not_found",
  LibrarySeasonEmpty: "library.season_empty",
  LibrarySeasonNotFound: "library.season_not_found",
  LibraryNoWatchToUndo: "library.no_watch_to_undo",
  LibraryEntryNotFound: "library.entry_not_found",
  LibraryEntryForbidden: "library.entry_forbidden",
  LibraryReplayNotMovie: "library.replay_not_movie",
  LibraryReplayNotFound: "library.replay_not_found",
  LibraryReplayForbidden: "library.replay_forbidden",

  // catalog — item/person/provider codes are shared across every catalogue
  // source (TMDB, AniList, IGDB, Open Library, MusicBrainz)
  CatalogUnknownMediaType: "catalog.unknown_media_type",
  CatalogNoPersonDetails: "catalog.no_person_details",
  CatalogMediaTypeRequired: "catalog.media_type_required",
  CatalogItemNotFound: "catalog.item_not_found",
  CatalogPersonNotFound: "catalog.person_not_found",
  CatalogProviderUnavailable: "catalog.provider_unavailable",
  CatalogSearchQueryRequired: "catalog.search_query_required",

  // users
  UserAvatarTooLarge: "user.avatar_too_large",
  UserAvatarInvalidType: "user.avatar_invalid_type",

  // import
  ImportSimklConnectionFailed: "import.simkl_connection_failed",
  ImportMalformedExport: "import.malformed_export",
  ImportJobNotFound: "import.job_not_found",
  ImportJobForbidden: "import.job_forbidden",
  ImportJobSourceMismatch: "import.job_source_mismatch",
  ImportJobNoAnalysis: "import.job_no_analysis",
  ImportUnknownSource: "import.unknown_source",
  ImportFreeQuotaExceeded: "import.free_quota_exceeded",
  ImportSourceUnavailable: "import.source_unavailable",
  ImportSteamProfileNotFound: "import.steam_profile_not_found",
  ImportSteamLibraryPrivate: "import.steam_library_private",
  ImportArchiveEmpty: "import.archive_empty",
  ImportArchiveUnreadable: "import.archive_unreadable",
  ImportArchiveMissingFiles: "import.archive_missing_files",
  ImportArchiveMalformed: "import.archive_malformed",

  // cross-cutting — owned by the infra rather than a single domain
  ValidationFailed: "validation.failed",
  InvalidParam: "validation.invalid_param",
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
