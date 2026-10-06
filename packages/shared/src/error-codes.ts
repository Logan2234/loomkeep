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
  /** A moderation suspension is in force; `params.until` is its ISO end. */
  AuthAccountSuspended: "auth.account_suspended",
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
  AuthWebauthnChallengeExpired: "auth.webauthn_challenge_expired",
  AuthWebauthnVerificationFailed: "auth.webauthn_verification_failed",
  AuthWebauthnCredentialNotFound: "auth.webauthn_credential_not_found",
  AuthPasswordlessRequiresCredential: "auth.passwordless_requires_credential",
  AuthPasswordlessNotEligible: "auth.passwordless_not_eligible",
  AuthInvalidInvitation: "auth.invalid_invitation",
  AuthInvitationExpired: "auth.invitation_expired",
  AuthInvitationEmailMismatch: "auth.invitation_email_mismatch",
  AuthInvalidApiKey: "auth.invalid_api_key",
  AuthApiKeyForbidden: "auth.api_key_forbidden",

  // api keys
  ApiKeyNotFound: "api_key.not_found",
  ApiKeyLimitReached: "api_key.limit_reached",
  ApiKeyExpiryInPast: "api_key.expiry_in_past",
  ApiRateLimited: "api.rate_limited",
  ApiDisabled: "api.disabled",
  SecretScanningUnauthorized: "api.secret_scanning_unauthorized",

  // admin
  AdminCacheItemNotFound: "admin.cache_item_not_found",
  AdminCacheResyncFailed: "admin.cache_resync_failed",
  AdminCacheItemReferenced: "admin.cache_item_referenced",
  AdminCacheItemHasContent: "admin.cache_item_has_content",
  AdminEmailTemplateNotFound: "admin.email_template_not_found",
  AdminSmtpNotConfigured: "admin.smtp_not_configured",
  AdminUnknownJob: "admin.unknown_job",
  AdminAccountNotFound: "admin.account_not_found",
  AdminReportNotFound: "admin.report_not_found",
  AdminSettingLockedByEnv: "admin.setting_locked_by_env",
  AdminCannotSelfDemote: "admin.cannot_self_demote",
  AdminCannotSelfDelete: "admin.cannot_self_delete",
  AdminForbidden: "admin.forbidden",
  AdminBackupNotFound: "admin.backup_not_found",
  AdminBackupNotOrphan: "admin.backup_not_orphan",
  AdminMisconfigured: "admin.misconfigured",
  AdminUnauthorized: "admin.unauthorized",
  AdminInvitationNotFound: "admin.invitation_not_found",
  AdminInvitationEmailRegistered: "admin.invitation_email_registered",
  AdminInvitationAlreadyPending: "admin.invitation_already_pending",
  AdminInvitationNotRenewable: "admin.invitation_not_renewable",

  // comments
  CommentUnknownTargetType: "comment.unknown_target_type",
  CommentParentNotFound: "comment.parent_not_found",
  CommentNotFound: "comment.not_found",
  CommentForbidden: "comment.forbidden",
  CommentParticipationRequiresLibrary: "comment.participation_requires_library",
  CommentInteractionBlocked: "comment.interaction_blocked",

  // chat
  ChatFeatureDisabled: "chat.feature_disabled",
  /** Messages only go between two accounts that follow each other. */
  ChatNotFriends: "chat.not_friends",
  ChatConversationNotFound: "chat.conversation_not_found",
  ChatMessageNotFound: "chat.message_not_found",
  ChatForbidden: "chat.forbidden",
  /** The conversation stays readable, but nobody can write in it anymore. */
  ChatReadOnly: "chat.read_only",
  /** The attached work isn't a page Loomkeep knows, or is an 18+ title. */
  ChatWorkNotFound: "chat.work_not_found",

  // lists
  ListInvalidMembershipTarget: "lists.invalid_membership_target",
  ListNotFound: "lists.not_found",
  ListOwnerOnlyVisibility: "lists.owner_only_visibility",
  ListForbidden: "lists.forbidden",
  ListItemNotFound: "lists.item_not_found",
  ListItemAlreadyExists: "lists.item_already_exists",
  ListReorderMismatch: "lists.reorder_mismatch",
  ListStale: "lists.stale",
  ListCannotAddSelf: "lists.cannot_add_self",
  ListMemberAlreadyEditor: "lists.member_already_editor",
  ListMemberNotFriend: "lists.member_not_friend",
  ListMembershipNotFound: "lists.membership_not_found",

  // newsletter
  NewsletterWebhookInvalidPayload: "newsletter.webhook_invalid_payload",
  NewsletterInvalidUnsubscribeLink: "newsletter.invalid_unsubscribe_link",
  NewsletterWebhookUnauthorized: "newsletter.webhook_unauthorized",

  // notifications
  NotificationNotFound: "notifications.not_found",
  NotificationPushEndpointTaken: "notifications.push_endpoint_taken",

  // reports
  ReportReasonRequired: "reports.reason_required",
  ReportInvalidMotif: "reports.invalid_motif",
  ReportNotFound: "reports.not_found",
  ReportAlreadyFiled: "reports.already_filed",
  ReportCannotReportOwnContent: "reports.cannot_report_own_content",

  // reviews
  ReviewUnknownTargetType: "reviews.unknown_target_type",
  ReviewNotFound: "reviews.not_found",
  ReviewCannotVoteSelf: "reviews.cannot_vote_self",

  // social
  SocialCannotFollowSelf: "social.cannot_follow_self",
  SocialGhostPublicOnly: "social.ghost_public_only",
  SocialUnblockFirst: "social.unblock_first",
  SocialFollowRequestNotFound: "social.follow_request_not_found",
  SocialCannotBlockSelf: "social.cannot_block_self",
  SocialFeatureDisabled: "social.feature_disabled",
  SocialActivityFeedUnavailable: "social.activity_feed_unavailable",

  // stats
  StatsRatingOrDecadeOnly: "stats.rating_or_decade_only",
  StatsInvalidRating: "stats.invalid_rating",
  StatsInvalidDecade: "stats.invalid_decade",
  StatsRatingOrDecadeRequired: "stats.rating_or_decade_required",

  // ee — the commercially licensed features (LICENSE-EE)
  EeUnlicensed: "ee.unlicensed",

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
  LibraryMovieNotReleased: "library.movie_not_released",
  LibraryAnimeNotAired: "library.anime_not_aired",
  LibraryGameNotReleased: "library.game_not_released",
  LibraryReplayNotFound: "library.replay_not_found",
  LibraryReplayForbidden: "library.replay_forbidden",
  LibrarySessionNotFound: "library.session_not_found",
  LibrarySessionForbidden: "library.session_forbidden",
  LibrarySessionDateFuture: "library.session_date_future",
  LibrarySessionInvalidPages: "library.session_invalid_pages",
  LibrarySessionTimerAlreadyRunning: "library.session_timer_already_running",
  LibrarySessionTimerNotFound: "library.session_timer_not_found",
  LibraryBookEditionRequired: "library.book_edition_required",
  LibrarySavedViewNotFound: "library.saved_view_not_found",
  LibrarySavedViewFreeQuotaExceeded: "library.saved_view_free_quota_exceeded",
  LibrarySavedViewLimitReached: "library.saved_view_limit_reached",
  LibraryBulkInvalid: "library.bulk_invalid",

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
  UserAdultContentDisabled: "user.adult_content_disabled",
  UserCsvExportUnavailable: "user.csv_export_unavailable",
  UserAccountNotFound: "user.account_not_found",
  UserNotFound: "user.not_found",
  UserDomainDisabled: "user.domain_disabled",
  UserAvatarNotFound: "user.avatar_not_found",
  UserPremiumRequired: "user.premium_required",
  UserBirthDateFuture: "user.birth_date_future",
  UserAdultContentRequiresBirthDate: "user.adult_content_requires_birth_date",
  UserMobileNavMissingMenu: "user.mobile_nav_missing_menu",
  UserEmailAlreadyCurrent: "user.email_already_current",
  UserEmailAlreadyExists: "user.email_already_exists",
  UserEmailChangeCodeInvalid: "user.email_change_code_invalid",
  UserPasswordSameAsCurrent: "user.password_same_as_current",
  UserUsernameTaken: "user.username_taken",

  // import
  ImportSimklConnectionFailed: "import.simkl_connection_failed",
  ImportMalformedExport: "import.malformed_export",
  ImportJobNotFound: "import.job_not_found",
  ImportJobForbidden: "import.job_forbidden",
  ImportJobSourceMismatch: "import.job_source_mismatch",
  ImportJobNoAnalysis: "import.job_no_analysis",
  ImportJobAlreadyRunning: "import.job_already_running",
  ImportUnknownSource: "import.unknown_source",
  ImportFreeQuotaExceeded: "import.free_quota_exceeded",
  ImportSourceUnavailable: "import.source_unavailable",
  ImportSteamProfileNotFound: "import.steam_profile_not_found",
  ImportSteamLibraryPrivate: "import.steam_library_private",
  ImportArchiveEmpty: "import.archive_empty",
  ImportArchiveUnreadable: "import.archive_unreadable",
  ImportArchiveMissingFiles: "import.archive_missing_files",
  ImportArchiveMalformed: "import.archive_malformed",

  // gamification
  GamificationAchievementNotFound: "gamification.achievement_not_found",
  GamificationFeatureDisabled: "gamification.feature_disabled",
  GamificationXpBelowZero: "gamification.xp_below_zero",
  GamificationBadgeSecret: "gamification.badge_secret",
  GamificationBadgeLimitReached: "gamification.badge_limit_reached",

  // cross-cutting — owned by the infra rather than a single domain
  ValidationFailed: "validation.failed",
  InvalidParam: "validation.invalid_param",
  InternalError: "internal.error",

  // client-side only — never emitted by the API, thrown by apps/web's
  // request() when the fetch itself fails (see apps/web/src/lib/api/core.ts)
  NetworkOffline: "network.offline",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Derives the Paraglide message key for an error code, e.g.
 * "library.episode_not_aired" -> "apierr_library_episode_not_aired".
 * `apierr_` (not `error_`) because `error_*` is already used by the generic
 * error page (error_generic_body, common_error...).
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
  details?: {
    field: string;
    constraint: string;
    params?: (string | number | boolean)[];
  }[];
  requestId?: string;
  /** Dev-facing English text: logs, Swagger, debugging. Never displayed to the user. */
  message: string;
}
