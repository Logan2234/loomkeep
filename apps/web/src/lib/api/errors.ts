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
  [ErrorCode.AuthPasswordBreached]: () => m.apierr_auth_password_breached(),
  [ErrorCode.AuthInvalidVerificationToken]: () =>
    m.apierr_auth_invalid_verification_token(),
  [ErrorCode.AuthAlreadyVerified]: () => m.apierr_auth_already_verified(),
  [ErrorCode.AuthInvalidCredentials]: () => m.apierr_auth_invalid_credentials(),
  [ErrorCode.AuthInvalidMfaChallenge]: () =>
    m.apierr_auth_invalid_mfa_challenge(),
  [ErrorCode.AuthMfaTooManyAttempts]: () =>
    m.apierr_auth_mfa_too_many_attempts(),
  [ErrorCode.AuthMfaInvalidCode]: () => m.apierr_auth_mfa_invalid_code(),
  [ErrorCode.AuthInvalidRefreshToken]: () =>
    m.apierr_auth_invalid_refresh_token(),
  [ErrorCode.AuthInvalidResetToken]: () => m.apierr_auth_invalid_reset_token(),
  [ErrorCode.AuthMfaTotpNotInProgress]: () =>
    m.apierr_auth_mfa_totp_not_in_progress(),
  [ErrorCode.AuthCurrentPasswordIncorrect]: () =>
    m.apierr_auth_current_password_incorrect(),
  [ErrorCode.AuthMissingAccessToken]: () =>
    m.apierr_auth_missing_access_token(),
  [ErrorCode.AuthInvalidAccessToken]: () =>
    m.apierr_auth_invalid_access_token(),
  [ErrorCode.AuthMissingExceptParam]: () =>
    m.apierr_auth_missing_except_param(),
  [ErrorCode.AdminCacheItemNotFound]: () =>
    m.apierr_admin_cache_item_not_found(),
  [ErrorCode.AdminCacheResyncFailed]: () =>
    m.apierr_admin_cache_resync_failed(),
  [ErrorCode.LibraryEpisodeNotAired]: () =>
    m.apierr_library_episode_not_aired(),
  [ErrorCode.LibraryCalendarUnavailable]: () =>
    m.apierr_library_calendar_unavailable(),
  [ErrorCode.LibraryEpisodeNotFound]: () =>
    m.apierr_library_episode_not_found(),
  [ErrorCode.LibrarySeasonEmpty]: () => m.apierr_library_season_empty(),
  [ErrorCode.LibrarySeasonNotFound]: () => m.apierr_library_season_not_found(),
  [ErrorCode.LibraryNoWatchToUndo]: () => m.apierr_library_no_watch_to_undo(),
  [ErrorCode.LibraryEntryNotFound]: () => m.apierr_library_entry_not_found(),
  [ErrorCode.LibraryEntryForbidden]: () => m.apierr_library_entry_forbidden(),
  [ErrorCode.LibraryReplayNotMovie]: () => m.apierr_library_replay_not_movie(),
  [ErrorCode.LibraryReplayNotFound]: () => m.apierr_library_replay_not_found(),
  [ErrorCode.LibraryReplayForbidden]: () => m.apierr_library_replay_forbidden(),
  [ErrorCode.CatalogUnknownMediaType]: () =>
    m.apierr_catalog_unknown_media_type(),
  [ErrorCode.CatalogNoPersonDetails]: () =>
    m.apierr_catalog_no_person_details(),
  [ErrorCode.CatalogMediaTypeRequired]: () =>
    m.apierr_catalog_media_type_required(),
  [ErrorCode.CatalogItemNotFound]: () => m.apierr_catalog_item_not_found(),
  [ErrorCode.CatalogPersonNotFound]: () => m.apierr_catalog_person_not_found(),
  [ErrorCode.CatalogProviderUnavailable]: () =>
    m.apierr_catalog_provider_unavailable(),
  [ErrorCode.CatalogSearchQueryRequired]: () =>
    m.apierr_catalog_search_query_required(),
  [ErrorCode.AdminCacheItemReferenced]: () =>
    m.apierr_admin_cache_item_referenced(),
  [ErrorCode.AdminCacheItemHasContent]: () =>
    m.apierr_admin_cache_item_has_content(),
  [ErrorCode.AdminEmailTemplateNotFound]: () =>
    m.apierr_admin_email_template_not_found(),
  [ErrorCode.AdminSmtpNotConfigured]: () =>
    m.apierr_admin_smtp_not_configured(),
  [ErrorCode.AdminUnknownJob]: () => m.apierr_admin_unknown_job(),
  [ErrorCode.AdminAccountNotFound]: () => m.apierr_admin_account_not_found(),
  [ErrorCode.AdminReportNotFound]: () => m.apierr_admin_report_not_found(),
  [ErrorCode.AdminCannotSelfDemote]: () => m.apierr_admin_cannot_self_demote(),
  [ErrorCode.AdminCannotSelfDelete]: () => m.apierr_admin_cannot_self_delete(),
  [ErrorCode.AdminUserNotFound]: () => m.apierr_admin_user_not_found(),
  [ErrorCode.AdminForbidden]: () => m.apierr_admin_forbidden(),
  [ErrorCode.AdminBackupNotFound]: () => m.apierr_admin_backup_not_found(),
  [ErrorCode.AdminMisconfigured]: () => m.apierr_admin_misconfigured(),
  [ErrorCode.AdminUnauthorized]: () => m.apierr_admin_unauthorized(),
  [ErrorCode.CommentUnknownTargetType]: () =>
    m.apierr_comment_unknown_target_type(),
  [ErrorCode.CommentParentNotFound]: () => m.apierr_comment_parent_not_found(),
  [ErrorCode.CommentNotFound]: () => m.apierr_comment_not_found(),
  [ErrorCode.CommentForbidden]: () => m.apierr_comment_forbidden(),
  [ErrorCode.ListInvalidMembershipTarget]: () =>
    m.apierr_lists_invalid_membership_target(),
  [ErrorCode.ListNotFound]: () => m.apierr_lists_not_found(),
  [ErrorCode.ListOwnerOnlyVisibility]: () =>
    m.apierr_lists_owner_only_visibility(),
  [ErrorCode.ListForbidden]: () => m.apierr_lists_forbidden(),
  [ErrorCode.ListItemNotFound]: () => m.apierr_lists_item_not_found(),
  [ErrorCode.ListItemAlreadyExists]: () => m.apierr_lists_item_already_exists(),
  [ErrorCode.ListReorderMismatch]: () => m.apierr_lists_reorder_mismatch(),
  [ErrorCode.ListStale]: () => m.apierr_lists_stale(),
  [ErrorCode.ListMemberUserNotFound]: () =>
    m.apierr_lists_member_user_not_found(),
  [ErrorCode.ListCannotAddSelf]: () => m.apierr_lists_cannot_add_self(),
  [ErrorCode.ListMemberAlreadyEditor]: () =>
    m.apierr_lists_member_already_editor(),
  [ErrorCode.ListMembershipNotFound]: () =>
    m.apierr_lists_membership_not_found(),
  [ErrorCode.NewsletterWebhookInvalidPayload]: () =>
    m.apierr_newsletter_webhook_invalid_payload(),
  [ErrorCode.NewsletterInvalidUnsubscribeLink]: () =>
    m.apierr_newsletter_invalid_unsubscribe_link(),
  [ErrorCode.NewsletterWebhookUnauthorized]: () =>
    m.apierr_newsletter_webhook_unauthorized(),
  [ErrorCode.NotificationNotFound]: () => m.apierr_notifications_not_found(),
  [ErrorCode.ReportReasonRequired]: () => m.apierr_reports_reason_required(),
  [ErrorCode.ReportInvalidMotif]: () => m.apierr_reports_invalid_motif(),
  [ErrorCode.ReportNotFound]: () => m.apierr_reports_not_found(),
  [ErrorCode.ReviewUnknownTargetType]: () =>
    m.apierr_reviews_unknown_target_type(),
  [ErrorCode.ReviewNotFound]: () => m.apierr_reviews_not_found(),
  [ErrorCode.ReviewCannotVoteSelf]: () => m.apierr_reviews_cannot_vote_self(),
  [ErrorCode.SocialUserNotFound]: () => m.apierr_social_user_not_found(),
  [ErrorCode.SocialCannotFollowSelf]: () =>
    m.apierr_social_cannot_follow_self(),
  [ErrorCode.SocialGhostPublicOnly]: () => m.apierr_social_ghost_public_only(),
  [ErrorCode.SocialUnblockFirst]: () => m.apierr_social_unblock_first(),
  [ErrorCode.SocialFollowRequestNotFound]: () =>
    m.apierr_social_follow_request_not_found(),
  [ErrorCode.SocialCannotBlockSelf]: () => m.apierr_social_cannot_block_self(),
  [ErrorCode.SocialFeatureDisabled]: () => m.apierr_social_feature_disabled(),
  [ErrorCode.StatsRatingOrDecadeOnly]: () =>
    m.apierr_stats_rating_or_decade_only(),
  [ErrorCode.StatsInvalidRating]: () => m.apierr_stats_invalid_rating(),
  [ErrorCode.StatsInvalidDecade]: () => m.apierr_stats_invalid_decade(),
  [ErrorCode.StatsRatingOrDecadeRequired]: () =>
    m.apierr_stats_rating_or_decade_required(),
  [ErrorCode.UserAdultContentDisabled]: () =>
    m.apierr_user_adult_content_disabled(),
  [ErrorCode.UserCsvExportUnavailable]: () =>
    m.apierr_user_csv_export_unavailable(),
  [ErrorCode.UserAccountNotFound]: () => m.apierr_user_account_not_found(),
  [ErrorCode.UserDomainDisabled]: () => m.apierr_user_domain_disabled(),
  [ErrorCode.UserAvatarNotFound]: () => m.apierr_user_avatar_not_found(),
  [ErrorCode.UserPremiumRequired]: () => m.apierr_user_premium_required(),
  [ErrorCode.UserBirthDateFuture]: () => m.apierr_user_birth_date_future(),
  [ErrorCode.UserAdultContentRequiresBirthDate]: () =>
    m.apierr_user_adult_content_requires_birth_date(),
  [ErrorCode.UserMobileNavMissingMenu]: () =>
    m.apierr_user_mobile_nav_missing_menu(),
  [ErrorCode.UserEmailAlreadyCurrent]: () =>
    m.apierr_user_email_already_current(),
  [ErrorCode.UserEmailAlreadyExists]: () =>
    m.apierr_user_email_already_exists(),
  [ErrorCode.UserEmailChangeCodeInvalid]: () =>
    m.apierr_user_email_change_code_invalid(),
  [ErrorCode.UserPasswordSameAsCurrent]: () =>
    m.apierr_user_password_same_as_current(),
  [ErrorCode.UserUsernameTaken]: () => m.apierr_user_username_taken(),
  [ErrorCode.UserAvatarTooLarge]: () => m.apierr_user_avatar_too_large(),
  [ErrorCode.UserAvatarInvalidType]: () => m.apierr_user_avatar_invalid_type(),
  [ErrorCode.ImportSimklConnectionFailed]: () =>
    m.apierr_import_simkl_connection_failed(),
  [ErrorCode.ImportMalformedExport]: () => m.apierr_import_malformed_export(),
  [ErrorCode.ImportJobNotFound]: () => m.apierr_import_job_not_found(),
  [ErrorCode.ImportJobForbidden]: () => m.apierr_import_job_forbidden(),
  [ErrorCode.ImportJobSourceMismatch]: () =>
    m.apierr_import_job_source_mismatch(),
  [ErrorCode.ImportJobNoAnalysis]: () => m.apierr_import_job_no_analysis(),
  [ErrorCode.ImportJobAlreadyRunning]: () =>
    m.apierr_import_job_already_running(),
  [ErrorCode.ImportUnknownSource]: () => m.apierr_import_unknown_source(),
  [ErrorCode.ImportFreeQuotaExceeded]: () =>
    m.apierr_import_free_quota_exceeded(),
  [ErrorCode.ImportSourceUnavailable]: () =>
    m.apierr_import_source_unavailable(),
  [ErrorCode.ImportSteamProfileNotFound]: () =>
    m.apierr_import_steam_profile_not_found(),
  [ErrorCode.ImportSteamLibraryPrivate]: () =>
    m.apierr_import_steam_library_private(),
  [ErrorCode.ImportArchiveEmpty]: () => m.apierr_import_archive_empty(),
  [ErrorCode.ImportArchiveUnreadable]: () =>
    m.apierr_import_archive_unreadable(),
  [ErrorCode.ImportArchiveMissingFiles]: () =>
    m.apierr_import_archive_missing_files(),
  [ErrorCode.ImportArchiveMalformed]: () => m.apierr_import_archive_malformed(),
  [ErrorCode.InvalidParam]: () => m.apierr_validation_invalid_param(),
  [ErrorCode.ValidationFailed]: () => m.apierr_validation_failed(),
  [ErrorCode.InternalError]: () => m.apierr_internal_error(),
  [ErrorCode.NetworkOffline]: () => m.apierr_network_offline(),
  [ErrorCode.GamificationAchievementNotFound]: () =>
    m.apierr_gamification_achievement_not_found(),
  [ErrorCode.GamificationFeatureDisabled]: () =>
    m.apierr_gamification_feature_disabled(),
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

  if (err.code && err.code in MESSAGES) {
    return MESSAGES[err.code]();
  }

  return statusFallback(err);
}
