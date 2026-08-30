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
  AdminImportRunDto,
  AdminImportSummaryDto,
  AdminNewAccountsTrendDto,
  AdminOverviewDto,
  AdminPushBroadcastResponseDto,
  AdminPushDeviceDto,
  AdminPushSendResponseDto,
  AdminPushSummaryDto,
  AdminReportsSummaryDto,
  AdminSecuritySummaryDto,
  AdminSocialActivityTrendDto,
  AdminSocialSectionDto,
  AdminSystemSectionDto,
  AdminUserCommentDto,
  AdminUserDto,
  AdminUserFilter,
  AdminUserLibraryStatsDto,
  AdminUserOptionDto,
  AdminUserPlanDto,
  AdminUserRoleDto,
  Domain,
  JobListResponseDto,
  JobStatus,
  MailTemplateListResponseDto,
  MailTemplatePreviewDto,
  ModerationLegalBasis,
  MyListDto,
  MyReviewDto,
  NewsletterSendDto,
  PagedResult,
  Plan,
  ReportDto,
  Role,
  SchemaGraphResponseDto,
  SecurityEventDto,
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

export interface ModerationReasonBody {
  reasonText: string;
  legalBasis: ModerationLegalBasis;
  tosClause: string;
}

export const getAdminServices = (): Promise<ServiceStatusResponseDto> =>
  request("/admin/services");

export const getAdminEmailTemplates =
  (): Promise<MailTemplateListResponseDto> => request("/admin/emails");

export function getAdminEmailPreview(
  key: string,
  values: Record<string, string> = {},
): Promise<MailTemplatePreviewDto> {
  const params = new URLSearchParams(values);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/emails/${key}/preview${suffix}`);
}

export const sendAdminTestEmail = (
  key: string,
  body: SendTestEmailRequestDto,
): Promise<void> =>
  request(`/admin/emails/${key}/test`, { method: "POST", body });

export const sendAdminTestPush = (
  body: SendAdminTestPushRequestDto,
): Promise<AdminPushSendResponseDto> =>
  request("/admin/push/test", { method: "POST", body });

export function getAdminPushDevices(
  email: string,
): Promise<AdminPushDeviceDto[]> {
  const params = new URLSearchParams({ email });
  return request(`/admin/push/devices?${params}`);
}

export const getAdminPushSummary = (): Promise<AdminPushSummaryDto> =>
  request("/admin/push/summary");

export const sendAdminBroadcastPush = (
  body: SendAdminBroadcastPushRequestDto,
): Promise<AdminPushBroadcastResponseDto> =>
  request("/admin/push/broadcast", { method: "POST", body });

export const getAdminSchema = (): Promise<SchemaGraphResponseDto> =>
  request("/admin/schema");

export const getAdminOverview = (): Promise<AdminOverviewDto> =>
  request("/admin/overview");

/** "Comptes & engagement" section of /admin/stats. */
export const getAdminAccountsStats = (): Promise<AdminAccountsSectionDto> =>
  request("/admin/stats/accounts");

export const getAdminNewAccountsTrend = (
  period: TrendPeriod,
): Promise<AdminNewAccountsTrendDto> =>
  request(`/admin/stats/accounts/new?period=${period}`);

/** "Catalogue & cache" section of /admin/stats. */
export const getAdminCatalogueStats = (): Promise<AdminCatalogueSectionDto> =>
  request("/admin/stats/catalogue");

export const getAdminSocialStats = (): Promise<AdminSocialSectionDto> =>
  request("/admin/stats/social");

export const getAdminSocialActivityTrend = (
  period: TrendPeriod,
): Promise<AdminSocialActivityTrendDto> =>
  request(`/admin/stats/social/activity?period=${period}`);

/** "Système" section of /admin/stats. */
export const getAdminSystemStats = (): Promise<AdminSystemSectionDto> =>
  request("/admin/stats/system");

export const getAdminJobs = (): Promise<JobListResponseDto> =>
  request("/admin/jobs");

/** Triggers a job immediately (both are idempotent). */
export const runAdminJob = (key: string): Promise<void> =>
  request(`/admin/jobs/${key}/run`, { method: "POST" });

/** Registered accounts, filterable by search/role/verification/activity, paginated. */
export function getAdminUsers(
  filters: {
    search?: string;
    filter?: AdminUserFilter;
    page?: number;
    limit?: number;
  } = {},
): Promise<PagedResult<AdminUserDto>> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.filter && filters.filter !== "all")
    params.set("filter", filters.filter);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/users${suffix}`);
}

export const getAdminUserOptions = (): Promise<AdminUserOptionDto[]> =>
  request("/admin/users/options");

export const getAdminUserLibraryStats = (
  userId: string,
): Promise<AdminUserLibraryStatsDto> =>
  request(`/admin/users/${userId}/library-stats`);

export const getAdminUserSessions = (userId: string): Promise<SessionDto[]> =>
  request(`/admin/users/${userId}/sessions`);

export const revokeAdminUserSession = (
  userId: string,
  sessionId: string,
): Promise<void> =>
  request(`/admin/users/${userId}/sessions/${sessionId}`, {
    method: "DELETE",
  });

export const revokeAllAdminUserSessions = (userId: string): Promise<void> =>
  request(`/admin/users/${userId}/sessions`, { method: "DELETE" });

export const updateAdminUserRole = (
  userId: string,
  role: Role,
): Promise<AdminUserRoleDto> =>
  request(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });

export const updateAdminUserPlan = (
  userId: string,
  plan: Plan,
): Promise<AdminUserPlanDto> =>
  request(`/admin/users/${userId}/plan`, {
    method: "PATCH",
    body: { plan },
  });

export const getAdminUserExport = (
  userId: string,
): Promise<UserDataExportDto> => request(`/admin/users/${userId}/export`);

/** Reviews the account has written, with resolved targets — for the user drawer shortcut. */
export const getAdminUserReviews = (userId: string): Promise<MyReviewDto[]> =>
  request(`/admin/users/${userId}/reviews`);

export const getAdminUserComments = (
  userId: string,
): Promise<AdminUserCommentDto[]> => request(`/admin/users/${userId}/comments`);

/** Accepted followers of the account (admin view, bypasses visibility). */
export const getAdminUserFollowers = (
  userId: string,
): Promise<UserSummaryDto[]> => request(`/admin/users/${userId}/followers`);

/** Accounts this user follows (admin view, bypasses visibility). */
export const getAdminUserFollowing = (
  userId: string,
): Promise<UserSummaryDto[]> => request(`/admin/users/${userId}/following`);

/** Reports filed against this account, directly or via a comment they authored. */
export const getAdminUserReportsAgainst = (
  userId: string,
): Promise<ReportDto[]> => request(`/admin/users/${userId}/reports-against`);

/** Every list the account owns, regardless of visibility (admin view). */
export const getAdminUserLists = (userId: string): Promise<MyListDto[]> =>
  request(`/admin/users/${userId}/lists`);

export const resendAdminUserVerification = (userId: string): Promise<void> =>
  request(`/admin/users/${userId}/resend-verification`, {
    method: "POST",
  });

export const sendAdminUserPasswordReset = (userId: string): Promise<void> =>
  request(`/admin/users/${userId}/reset-password-link`, {
    method: "POST",
  });

/** Permanently deletes an account and all its data. Irreversible. */
export const deleteAdminUser = (
  userId: string,
  reason: ModerationReasonBody,
): Promise<void> =>
  request(`/admin/users/${userId}`, { method: "DELETE", body: reason });

export const getAdminNewsletterSends = (): Promise<NewsletterSendDto[]> =>
  request("/admin/newsletter");

export const getAdminBackupFiles = (): Promise<AdminBackupFileDto[]> =>
  request("/admin/backup/files");

export const getAdminBackupFile = (
  id: string,
): Promise<AdminBackupFileContentDto> => request(`/admin/backup/files/${id}`);

export const deleteAdminBackupFile = (id: string): Promise<void> =>
  request(`/admin/backup/files/${id}`, { method: "DELETE" });

/** Irreversible. */
export const restoreAdminBackup = (
  body: AdminBackupRestoreRequestDto,
): Promise<void> => request("/admin/backup/restore", { method: "POST", body });

export function getAdminCache(filters: {
  domain: Domain;
  search?: string;
  sort?: AdminCacheSort;
  orphans?: boolean;
  page?: number;
  limit?: number;
}): Promise<AdminCacheListResponseDto> {
  const params = new URLSearchParams({ domain: filters.domain });
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.orphans) params.set("orphans", "true");
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return request(`/admin/cache?${params}`);
}

/** Full detail of one cached item (external ids, metadata, media seasons). */
export const getAdminCacheItem = (
  domain: Domain,
  id: string,
): Promise<AdminCacheItemDetailDto> => request(`/admin/cache/${domain}/${id}`);

/** Forces a re-sync of one cached item from its canonical source, bypassing the TTL. */
export const resyncAdminCacheItem = (
  domain: Domain,
  id: string,
): Promise<void> =>
  request(`/admin/cache/${domain}/${id}/resync`, { method: "POST" });

/** Re-syncs every stale (>24h) item in a domain in one pass. */
export const resyncAdminCacheStale = (
  domain: Domain,
): Promise<AdminCacheResyncStaleResultDto> =>
  request(`/admin/cache/${domain}/resync-stale`, { method: "POST" });

/** Deletes an orphaned cached item (no account references it). 409 if referenced. */
export const deleteAdminCacheItem = (
  domain: Domain,
  id: string,
): Promise<void> =>
  request(`/admin/cache/${domain}/${id}`, { method: "DELETE" });

export const deleteAdminCacheOrphans = (
  domain: Domain,
): Promise<AdminCacheDeleteOrphansResultDto> =>
  request(`/admin/cache/${domain}/orphans`, { method: "DELETE" });

/** Past import commits across every account, filterable by source/status/account, paginated. */
export function getAdminImportRuns(
  filters: {
    source?: string;
    status?: JobStatus;
    userId?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<PagedResult<AdminImportRunDto>> {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/imports${suffix}`);
}

export const getAdminImportSummary = (): Promise<AdminImportSummaryDto> =>
  request("/admin/imports/summary");

export const getAdminSecuritySummary = (): Promise<AdminSecuritySummaryDto> =>
  request("/admin/security/summary");

export function getAdminSecurityEvents(
  filters: {
    type?: SecurityEventType;
    identifier?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<PagedResult<SecurityEventDto>> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.identifier) params.set("identifier", filters.identifier);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/security${suffix}`);
}

/** The comment/review/user moderation queue, filterable by status/reporter, paginated. */
export function getAdminReports(
  filters: {
    status?: string;
    page?: number;
    limit?: number;
    reporterId?: string;
  } = {},
): Promise<PagedResult<ReportDto>> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1)
    params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.reporterId) params.set("reporterId", filters.reporterId);
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/reports${suffix}`);
}

export const getAdminReportsSummary = (): Promise<AdminReportsSummaryDto> =>
  request("/admin/reports/summary");

export function getAdminReportsPendingCount(): Promise<{ count: number }> {
  return request("/admin/reports/pending-count");
}

export const resolveAdminReport = (
  id: string,
  status: "RESOLVED" | "DISMISSED",
): Promise<void> =>
  request(`/admin/reports/${id}/resolve`, {
    method: "POST",
    body: { status },
  });

/** Removes the reported content (comment tombstone), notifies its author (DSA art. 17), and resolves the report. */
export const takeDownAdminReport = (
  id: string,
  reason: ModerationReasonBody,
): Promise<void> =>
  request(`/admin/reports/${id}/take-down`, {
    method: "POST",
    body: reason,
  });
