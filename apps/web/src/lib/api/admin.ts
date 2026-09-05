import type {
  AdminBackupRestoreRequestDto,
  AdminCacheSort,
  Domain,
  JobStatus,
  Locale,
  MailTemplatePreviewDto,
  ModerationLegalBasis,
  Plan,
  Role,
  SecurityEventType,
  SendAdminBroadcastPushRequestDto,
  SendAdminTestPushRequestDto,
  SendTestEmailRequestDto,
  TrendPeriod,
} from "@loomkeep/shared";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

export interface ModerationReasonBody {
  reasonText: string;
  legalBasis: ModerationLegalBasis;
  tosClause: string;
}

export const getAdminServices = () => typedRequest("/admin/services");

export const getAdminEmailTemplates = () => typedRequest("/admin/emails");

// Not migrated: the query is a fully dynamic Record<string, string> (one
// entry per template field), which @Query() overrides: Record<...> doesn't
// give the swagger plugin anything to describe — typedRequest sees no query
// shape at all for this route.
export function getAdminEmailPreview(
  key: string,
  locale: Locale,
  values: Record<string, string> = {},
): Promise<MailTemplatePreviewDto> {
  const params = new URLSearchParams({ locale, ...values });
  const suffix = params.size > 0 ? `?${params}` : "";
  return request(`/admin/emails/${key}/preview${suffix}`);
}

export const sendAdminTestEmail = (
  key: string,
  body: SendTestEmailRequestDto,
): Promise<void> =>
  typedRequest("/admin/emails/{key}/test", {
    method: "POST",
    params: { key },
    body,
  });

export const sendAdminTestPush = (body: SendAdminTestPushRequestDto) =>
  typedRequest("/admin/push/test", { method: "POST", body });

export function getAdminPushDevices(email: string) {
  return typedRequest("/admin/push/devices", { query: { email } });
}

export const getAdminPushSummary = () => typedRequest("/admin/push/summary");

export const sendAdminBroadcastPush = (
  body: SendAdminBroadcastPushRequestDto,
) => typedRequest("/admin/push/broadcast", { method: "POST", body });

export const getAdminSchema = () => typedRequest("/admin/schema");

export const getAdminOverview = () => typedRequest("/admin/overview");

/** "Comptes & engagement" section of /admin/stats. */
export const getAdminAccountsStats = () =>
  typedRequest("/admin/stats/accounts");

export const getAdminNewAccountsTrend = (period: TrendPeriod) =>
  typedRequest("/admin/stats/accounts/new", { query: { period } });

/** "Catalogue & cache" section of /admin/stats. */
export const getAdminCatalogueStats = () =>
  typedRequest("/admin/stats/catalogue");

export const getAdminSocialStats = () => typedRequest("/admin/stats/social");

export const getAdminSocialActivityTrend = (period: TrendPeriod) =>
  typedRequest("/admin/stats/social/activity", { query: { period } });

/** "Système" section of /admin/stats. */
export const getAdminSystemStats = () => typedRequest("/admin/stats/system");

export const getAdminJobs = () => typedRequest("/admin/jobs");

/** Triggers a job immediately (both are idempotent). */
export const runAdminJob = (key: string): Promise<void> =>
  typedRequest("/admin/jobs/{key}/run", { method: "POST", params: { key } });

/** Registered accounts, filterable by search/role/verification/activity, paginated. */
export function getAdminUsers(
  filters: {
    search?: string;
    filter?: "all" | "admin" | "unverified" | "never";
    page?: number;
    limit?: number;
  } = {},
) {
  return typedRequest("/admin/users", {
    query: {
      search: filters.search,
      filter:
        filters.filter && filters.filter !== "all" ? filters.filter : undefined,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });
}

export const getAdminUserOptions = () => typedRequest("/admin/users/options");

export const getAdminUserLibraryStats = (userId: string) =>
  typedRequest("/admin/users/{userId}/library-stats", { params: { userId } });

export const getAdminUserSessions = (userId: string) =>
  typedRequest("/admin/users/{userId}/sessions", { params: { userId } });

export const revokeAdminUserSession = (
  userId: string,
  sessionId: string,
): Promise<void> =>
  typedRequest("/admin/users/{userId}/sessions/{sessionId}", {
    method: "DELETE",
    params: { userId, sessionId },
  });

export const revokeAllAdminUserSessions = (userId: string): Promise<void> =>
  typedRequest("/admin/users/{userId}/sessions", {
    method: "DELETE",
    params: { userId },
  });

export const updateAdminUserRole = (userId: string, role: Role) =>
  typedRequest("/admin/users/{userId}/role", {
    method: "PATCH",
    params: { userId },
    body: { role },
  });

export const updateAdminUserPlan = (userId: string, plan: Plan) =>
  typedRequest("/admin/users/{userId}/plan", {
    method: "PATCH",
    params: { userId },
    body: { plan },
  });

export const getAdminUserExport = (userId: string) =>
  typedRequest("/admin/users/{userId}/export", { params: { userId } });

/** Reviews the account has written, with resolved targets — for the user drawer shortcut. */
export const getAdminUserReviews = (userId: string) =>
  typedRequest("/admin/users/{userId}/reviews", { params: { userId } });

export const getAdminUserComments = (userId: string) =>
  typedRequest("/admin/users/{userId}/comments", { params: { userId } });

/** Accepted followers of the account (admin view, bypasses visibility). */
export const getAdminUserFollowers = (userId: string) =>
  typedRequest("/admin/users/{userId}/followers", { params: { userId } });

/** Accounts this user follows (admin view, bypasses visibility). */
export const getAdminUserFollowing = (userId: string) =>
  typedRequest("/admin/users/{userId}/following", { params: { userId } });

/** Reports filed against this account, directly or via a comment they authored. */
export const getAdminUserReportsAgainst = (userId: string) =>
  typedRequest("/admin/users/{userId}/reports-against", { params: { userId } });

/** Every list the account owns, regardless of visibility (admin view). */
export const getAdminUserLists = (userId: string) =>
  typedRequest("/admin/users/{userId}/lists", { params: { userId } });

export const resendAdminUserVerification = (userId: string): Promise<void> =>
  typedRequest("/admin/users/{userId}/resend-verification", {
    method: "POST",
    params: { userId },
  });

export const sendAdminUserPasswordReset = (userId: string): Promise<void> =>
  typedRequest("/admin/users/{userId}/reset-password-link", {
    method: "POST",
    params: { userId },
  });

/** Permanently deletes an account and all its data. Irreversible. */
export const deleteAdminUser = (
  userId: string,
  reason: ModerationReasonBody,
): Promise<void> =>
  typedRequest("/admin/users/{userId}", {
    method: "DELETE",
    params: { userId },
    body: reason,
  });

export const getAdminNewsletterSends = () => typedRequest("/admin/newsletter");

export const getAdminBackupFiles = () => typedRequest("/admin/backup/files");

export const getAdminBackupFile = (id: string) =>
  typedRequest("/admin/backup/files/{id}", { params: { id } });

export const deleteAdminBackupFile = (id: string): Promise<void> =>
  typedRequest("/admin/backup/files/{id}", {
    method: "DELETE",
    params: { id },
  });

/** Irreversible. */
export const restoreAdminBackup = (
  body: AdminBackupRestoreRequestDto,
): Promise<void> =>
  typedRequest("/admin/backup/restore", { method: "POST", body });

export function getAdminCache(filters: {
  domain: Domain;
  search?: string;
  sort?: AdminCacheSort;
  orphans?: boolean;
  page?: number;
  limit?: number;
}) {
  return typedRequest("/admin/cache", {
    query: {
      domain: filters.domain,
      search: filters.search,
      sort: filters.sort,
      orphans: filters.orphans ? "true" : undefined,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });
}

/** Full detail of one cached item (external ids, metadata, media seasons). */
export const getAdminCacheItem = (domain: Domain, id: string) =>
  typedRequest("/admin/cache/{domain}/{id}", { params: { domain, id } });

/** Forces a re-sync of one cached item from its canonical source, bypassing the TTL. */
export const resyncAdminCacheItem = (
  domain: Domain,
  id: string,
): Promise<void> =>
  typedRequest("/admin/cache/{domain}/{id}/resync", {
    method: "POST",
    params: { domain, id },
  });

/** Re-syncs every stale (>24h) item in a domain in one pass. */
export const resyncAdminCacheStale = (domain: Domain) =>
  typedRequest("/admin/cache/{domain}/resync-stale", {
    method: "POST",
    params: { domain },
  });

/** Deletes an orphaned cached item (no account references it). 409 if referenced. */
export const deleteAdminCacheItem = (
  domain: Domain,
  id: string,
): Promise<void> =>
  typedRequest("/admin/cache/{domain}/{id}", {
    method: "DELETE",
    params: { domain, id },
  });

export const deleteAdminCacheOrphans = (domain: Domain) =>
  typedRequest("/admin/cache/{domain}/orphans", {
    method: "DELETE",
    params: { domain },
  });

/** Past import commits across every account, filterable by source/status/account, paginated. */
export function getAdminImportRuns(
  filters: {
    source?: string;
    status?: JobStatus;
    userId?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  return typedRequest("/admin/imports", {
    query: {
      source: filters.source,
      status: filters.status,
      userId: filters.userId,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });
}

export const getAdminImportSummary = () =>
  typedRequest("/admin/imports/summary");

export const getAdminSecuritySummary = () =>
  typedRequest("/admin/security/summary");

export function getAdminSecurityEvents(
  filters: {
    type?: SecurityEventType;
    identifier?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  return typedRequest("/admin/security", {
    query: {
      type: filters.type,
      identifier: filters.identifier,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });
}

/** The comment/review/user moderation queue, filterable by status/reporter, paginated. */
export function getAdminReports(
  filters: {
    status?: string;
    page?: number;
    limit?: number;
    reporterId?: string;
  } = {},
) {
  return typedRequest("/admin/reports", {
    query: {
      status: filters.status,
      page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
      limit: filters.limit ? String(filters.limit) : undefined,
      reporterId: filters.reporterId,
    },
  });
}

export const getAdminReportsSummary = () =>
  typedRequest("/admin/reports/summary");

export const getAdminReportsPendingCount = () =>
  typedRequest("/admin/reports/pending-count");

export const resolveAdminReport = (
  id: string,
  status: "RESOLVED" | "DISMISSED",
): Promise<void> =>
  typedRequest("/admin/reports/{id}/resolve", {
    method: "POST",
    params: { id },
    body: { status },
  });

/** Removes the reported content (comment tombstone), notifies its author (DSA art. 17), and resolves the report. */
export const takeDownAdminReport = (
  id: string,
  reason: ModerationReasonBody,
): Promise<void> =>
  typedRequest("/admin/reports/{id}/take-down", {
    method: "POST",
    params: { id },
    body: reason,
  });
