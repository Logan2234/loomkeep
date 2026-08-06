import type {
  AdminAccountsSectionDto,
  AdminBackupFileContentDto,
  AdminBackupFileDto,
  AdminBackupRestoreRequestDto,
  AdminCacheDeleteOrphansResultDto,
  AdminCacheItemDetailDto,
  AdminCacheListResponseDto,
  AdminCacheResyncStaleResultDto,
  AdminCacheSort,
  AdminCatalogueSectionDto,
  AdminImportRunListResponseDto,
  AdminImportSummaryDto,
  AdminNewAccountsTrendDto,
  AdminPushBroadcastResponseDto,
  AdminPushDeviceDto,
  AdminPushSendResponseDto,
  AdminPushSummaryDto,
  AdminOverviewDto,
  AdminReportsSummaryDto,
  AdminSecuritySummaryDto,
  AdminSocialActivityTrendDto,
  AdminSocialSectionDto,
  AdminSystemSectionDto,
  AdminUserCommentDto,
  AdminUserFilter,
  AdminUserListResponseDto,
  AdminUserOptionDto,
  AdminUserRoleDto,
  AdminVersionDto,
  Domain,
  JobListResponseDto,
  JobStatus,
  MyListDto,
  MyReviewDto,
  ReportDto,
  ReportPageDto,
  MailTemplateListResponseDto,
  MailTemplatePreviewDto,
  Role,
  SchemaGraphResponseDto,
  SecurityEventListResponseDto,
  SecurityEventType,
  SendAdminBroadcastPushRequestDto,
  SendAdminTestPushRequestDto,
  SendTestEmailRequestDto,
  ServiceStatusResponseDto,
  SessionDto,
  TrendPeriod,
  UserDataExportDto,
  UserSummaryDto,
} from "@loomkeep/shared";
import { request } from "./core";

/** Health and quota usage of every external dependency (config presence, live probe, call counters). */
export function getAdminServices(): Promise<ServiceStatusResponseDto> {
  return request("/admin/services");
}

export function getAdminEmailTemplates(): Promise<MailTemplateListResponseDto> {
  return request("/admin/emails");
}

export function getAdminEmailPreview(
  key: string,
  values: Record<string, string> = {},
): Promise<MailTemplatePreviewDto> {
  const params = new URLSearchParams(values);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/emails/${key}/preview${suffix}`);
}

export function sendAdminTestEmail(
  key: string,
  body: SendTestEmailRequestDto,
): Promise<void> {
  return request(`/admin/emails/${key}/test`, { method: "POST", body });
}

export function sendAdminTestPush(
  body: SendAdminTestPushRequestDto,
): Promise<AdminPushSendResponseDto> {
  return request("/admin/push/test", { method: "POST", body });
}

export function getAdminPushDevices(
  email: string,
): Promise<AdminPushDeviceDto[]> {
  const params = new URLSearchParams({ email });
  return request(`/admin/push/devices?${params}`);
}

/** Instance-wide push reach (active subscriptions, accounts, browser families). */
export function getAdminPushSummary(): Promise<AdminPushSummaryDto> {
  return request("/admin/push/summary");
}

/** Sends one push to every subscribed device on the instance, across every account. */
export function sendAdminBroadcastPush(
  body: SendAdminBroadcastPushRequestDto,
): Promise<AdminPushBroadcastResponseDto> {
  return request("/admin/push/broadcast", { method: "POST", body });
}

/** Locally-generated architecture diagrams (DB ERD, module graph). */
export function getAdminSchema(): Promise<SchemaGraphResponseDto> {
  return request("/admin/schema");
}

/** The few instance counters the admin dashboard and /admin/communications read. */
export function getAdminOverview(): Promise<AdminOverviewDto> {
  return request("/admin/overview");
}

/** "Comptes & engagement" section of /admin/stats. */
export function getAdminAccountsStats(): Promise<AdminAccountsSectionDto> {
  return request("/admin/stats/accounts");
}

/** Registration curve alone — re-queried by the card's own period picker. */
export function getAdminNewAccountsTrend(
  period: TrendPeriod,
): Promise<AdminNewAccountsTrendDto> {
  return request(`/admin/stats/accounts/new?period=${period}`);
}

/** "Catalogue & cache" section of /admin/stats. */
export function getAdminCatalogueStats(): Promise<AdminCatalogueSectionDto> {
  return request("/admin/stats/catalogue");
}

/** "Social" section of /admin/stats — `{ enabled: false }` when SOCIAL_ENABLED is off. */
export function getAdminSocialStats(): Promise<AdminSocialSectionDto> {
  return request("/admin/stats/social");
}

/** Social activity curve alone — re-queried by the card's own period picker. */
export function getAdminSocialActivityTrend(
  period: TrendPeriod,
): Promise<AdminSocialActivityTrendDto> {
  return request(`/admin/stats/social/activity?period=${period}`);
}

/** "Système" section of /admin/stats. */
export function getAdminSystemStats(): Promise<AdminSystemSectionDto> {
  return request("/admin/stats/system");
}

/** Every known scheduled job, with its recent run history. */
export function getAdminJobs(): Promise<JobListResponseDto> {
  return request("/admin/jobs");
}

/** Triggers a job immediately (both are idempotent). */
export function runAdminJob(key: string): Promise<void> {
  return request(`/admin/jobs/${key}/run`, { method: "POST" });
}

/** Registered accounts, filterable by search/role/verification/activity, paginated. */
export function getAdminUsers(
  filters: {
    search?: string;
    filter?: AdminUserFilter;
    page?: number;
  } = {},
): Promise<AdminUserListResponseDto> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.filter && filters.filter !== "all")
    params.set("filter", filters.filter);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/users${suffix}`);
}

/** Minimal, unpaginated account list for a picker (UserSelector, communications broadcast target). */
export function getAdminUserOptions(): Promise<AdminUserOptionDto[]> {
  return request("/admin/users/options");
}

export function getAdminUserSessions(userId: string): Promise<SessionDto[]> {
  return request(`/admin/users/${userId}/sessions`);
}

export function revokeAdminUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  return request(`/admin/users/${userId}/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

/** Revokes every device for an account in one go. */
export function revokeAllAdminUserSessions(userId: string): Promise<void> {
  return request(`/admin/users/${userId}/sessions`, { method: "DELETE" });
}

/** Sets an account's role (e.g. toggling admin access). */
export function updateAdminUserRole(
  userId: string,
  role: Role,
): Promise<AdminUserRoleDto> {
  return request(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

/** Full portable dump of one account's data (GDPR "download my data"), admin-triggered. */
export function getAdminUserExport(userId: string): Promise<UserDataExportDto> {
  return request(`/admin/users/${userId}/export`);
}

/** Reviews the account has written, with resolved targets — for the user drawer shortcut. */
export function getAdminUserReviews(userId: string): Promise<MyReviewDto[]> {
  return request(`/admin/users/${userId}/reviews`);
}

/** Comments the account has authored — for the user drawer shortcut. */
export function getAdminUserComments(
  userId: string,
): Promise<AdminUserCommentDto[]> {
  return request(`/admin/users/${userId}/comments`);
}

/** Accepted followers of the account (admin view, bypasses visibility). */
export function getAdminUserFollowers(
  userId: string,
): Promise<UserSummaryDto[]> {
  return request(`/admin/users/${userId}/followers`);
}

/** Accounts this user follows (admin view, bypasses visibility). */
export function getAdminUserFollowing(
  userId: string,
): Promise<UserSummaryDto[]> {
  return request(`/admin/users/${userId}/following`);
}

/** Reports filed against this account, directly or via a comment they authored. */
export function getAdminUserReportsAgainst(
  userId: string,
): Promise<ReportDto[]> {
  return request(`/admin/users/${userId}/reports-against`);
}

/** Every list the account owns, regardless of visibility (admin view). */
export function getAdminUserLists(userId: string): Promise<MyListDto[]> {
  return request(`/admin/users/${userId}/lists`);
}

/** Re-sends the account's email-verification link. */
export function resendAdminUserVerification(userId: string): Promise<void> {
  return request(`/admin/users/${userId}/resend-verification`, {
    method: "POST",
  });
}

/** Sends the account a password-reset link. */
export function sendAdminUserPasswordReset(userId: string): Promise<void> {
  return request(`/admin/users/${userId}/reset-password-link`, {
    method: "POST",
  });
}

/** Permanently deletes an account and all its data. Irreversible. */
export function deleteAdminUser(userId: string): Promise<void> {
  return request(`/admin/users/${userId}`, { method: "DELETE" });
}

/** The running app's version, shown in the admin/settings footer. */
export function getAdminVersion(): Promise<AdminVersionDto> {
  return request("/admin/version");
}

/** Persisted backup dumps on disk, most recent first — up to 7, pruned by the daily job. */
export function getAdminBackupFiles(): Promise<AdminBackupFileDto[]> {
  return request("/admin/backup/files");
}

/** Full SQL content of one persisted backup, for download. */
export function getAdminBackupFile(
  id: string,
): Promise<AdminBackupFileContentDto> {
  return request(`/admin/backup/files/${id}`);
}

export function deleteAdminBackupFile(id: string): Promise<void> {
  return request(`/admin/backup/files/${id}`, { method: "DELETE" });
}

/** Replaces the entire instance database with a previously downloaded dump. Irreversible. */
export function restoreAdminBackup(
  body: AdminBackupRestoreRequestDto,
): Promise<void> {
  return request("/admin/backup/restore", { method: "POST", body });
}

/** Cached items for one domain, ordered by `sort`, filterable by title/orphans and paginated. */
export function getAdminCache(filters: {
  domain: Domain;
  search?: string;
  sort?: AdminCacheSort;
  orphans?: boolean;
  page?: number;
}): Promise<AdminCacheListResponseDto> {
  const params = new URLSearchParams({ domain: filters.domain });
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.orphans) params.set("orphans", "true");
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  return request(`/admin/cache?${params}`);
}

/** Full detail of one cached item (external ids, metadata, media seasons). */
export function getAdminCacheItem(
  domain: Domain,
  id: string,
): Promise<AdminCacheItemDetailDto> {
  return request(`/admin/cache/${domain}/${id}`);
}

/** Forces a re-sync of one cached item from its canonical source, bypassing the TTL. */
export function resyncAdminCacheItem(
  domain: Domain,
  id: string,
): Promise<void> {
  return request(`/admin/cache/${domain}/${id}/resync`, { method: "POST" });
}

/** Re-syncs every stale (>24h) item in a domain in one pass. */
export function resyncAdminCacheStale(
  domain: Domain,
): Promise<AdminCacheResyncStaleResultDto> {
  return request(`/admin/cache/${domain}/resync-stale`, { method: "POST" });
}

/** Deletes an orphaned cached item (no account references it). 409 if referenced. */
export function deleteAdminCacheItem(
  domain: Domain,
  id: string,
): Promise<void> {
  return request(`/admin/cache/${domain}/${id}`, { method: "DELETE" });
}

/** Purges every orphaned (unreferenced) item in a domain in one pass. */
export function deleteAdminCacheOrphans(
  domain: Domain,
): Promise<AdminCacheDeleteOrphansResultDto> {
  return request(`/admin/cache/${domain}/orphans`, { method: "DELETE" });
}

/** Past import commits across every account, filterable by source/status/account, paginated. */
export function getAdminImportRuns(
  filters: {
    source?: string;
    status?: JobStatus;
    userId?: string;
    page?: number;
  } = {},
): Promise<AdminImportRunListResponseDto> {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/imports${suffix}`);
}

/** Totals/success rate/per-source volume over the whole import log, ignoring the list filters. */
export function getAdminImportSummary(): Promise<AdminImportSummaryDto> {
  return request("/admin/imports/summary");
}

/** Failed-login pressure over 24 h / 7 j / 30 j, plus the most-targeted identifiers. */
export function getAdminSecuritySummary(): Promise<AdminSecuritySummaryDto> {
  return request("/admin/security/summary");
}

/** Sensitive account actions, filterable by type and identifier, paginated. */
export function getAdminSecurityEvents(
  filters: {
    type?: SecurityEventType;
    identifier?: string;
    page?: number;
  } = {},
): Promise<SecurityEventListResponseDto> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.identifier) params.set("identifier", filters.identifier);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/security${suffix}`);
}

/** The comment/review/user moderation queue, filterable by status/reporter, paginated. */
export function getAdminReports(
  filters: {
    status?: string;
    page?: number;
    reporterId?: string;
  } = {},
): Promise<ReportPageDto> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  if (filters.reporterId) params.set("reporterId", filters.reporterId);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/reports${suffix}`);
}

/** Queue-wide moderation figures (statuses, delay, founded share, top reporters). */
export function getAdminReportsSummary(): Promise<AdminReportsSummaryDto> {
  return request("/admin/reports/summary");
}

export function getAdminReportsPendingCount(): Promise<{ count: number }> {
  return request("/admin/reports/pending-count");
}

export function resolveAdminReport(
  id: string,
  status: "RESOLVED" | "DISMISSED",
): Promise<void> {
  return request(`/admin/reports/${id}/resolve`, {
    method: "POST",
    body: { status },
  });
}

/** Removes the reported content (comment tombstone) and resolves the report. */
export function takeDownAdminReport(id: string): Promise<void> {
  return request(`/admin/reports/${id}/take-down`, { method: "POST" });
}
