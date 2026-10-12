import type { JobStatus } from "./admin-jobs";
/** Bucket granularity for the admin trend charts. */
export const TREND_PERIODS = ["day", "week", "month", "year"] as const;

export type TrendPeriod = (typeof TREND_PERIODS)[number];

export interface TrendPointDto {
  /** ISO date (UTC) of the bucket's start. */
  periodStart: string;
  count: number;
}

/**
 * The few instance counters the admin *dashboard* (/admin) and
 * /admin/communications need for their status strips, not a statistics
 * payload. Everything analytical lives on /admin/stats (dto/admin-stats.ts).
 */
export interface AdminOverviewDto {
  accounts: number;
  /** Accounts created since the start of the current weekly bucket. */
  newAccountsThisWeek: number;
  /** Accounts with at least one push subscription. */
  accountsWithPush: number;
  /** Push subscription rows (an account can have several devices). */
  pushDevices: number;
  /** Cached works across all four domains. */
  cachedItems: number;
}

export type AdminImportStatus = JobStatus | "RUNNING";

export interface AdminImportDetails {
  items: { title: string; state: "selected" | "ignored" | "unresolved" }[];
  report: import("./import").ImportReport | null;
}

export interface AdminImportDetailDto extends AdminImportRunDto {
  details: AdminImportDetails | null;
}

export interface AdminImportRunDto {
  id: string;
  /** Null once the account has since been deleted. */
  userId: string | null;
  /** The linked account's current email — null once the account is deleted. */
  identifier: string | null;
  /** Import source id ("tvtime", "storygraph", "goodreads", "steam"). */
  sourceId: string;
  status: AdminImportStatus;
  /** Present on an active in-memory import, before it is persisted. */
  phase?: "analyze" | "commit";
  /** Items actually written, regardless of outcome. */
  itemCount: number;
  /** Whether the commit wiped the domain's library first (destructive replace). */
  overwrite: boolean;
  /** Human summary joined from the report's tiles; null on failure. */
  summary: string | null;
  /** Present only when `status` is "FAILURE". */
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  progress?: { done: number; total: number };
}

/** Committed imports for one source, all accounts and all time. */
export interface AdminImportSourceStatDto {
  /** Import source id ("tvtime", "storygraph", "goodreads", "steam"). */
  sourceId: string;
  runs: number;
  /** Items written by those runs. */
  items: number;
}

/**
 * Header summary of the admin "Imports" page. Computed over every logged run,
 * never over the page currently displayed — the list is paginated and filtered,
 * so a client-side total would drift as soon as the admin scrolls or filters.
 */
export interface AdminImportSummaryDto {
  total: number;
  success: number;
  failure: number;
  /** Share (0-100) of runs that succeeded; null while nothing was ever imported. */
  successPercent: number | null;
  /** Most items first. */
  bySource: AdminImportSourceStatDto[];
}

export interface AdminTopReporterDto {
  username: string;
  reports: number;
}

/**
 * Header summary of the admin "Signalements" page, over the whole queue rather
 * than the cursor page on screen. Same figures as the /admin/stats "Social"
 * moderation card (they share the API-side helpers), plus the reporter ranking
 * that only makes sense next to the queue itself.
 */
export interface AdminReportsSummaryDto {
  pending: number;
  resolved: number;
  dismissed: number;
  /** Median hours between filing and closing; null while nothing is closed. */
  medianResolutionHours: number | null;
  /** Share (0-100) of closed reports acted on rather than dismissed; null while nothing is closed. */
  foundedPercent: number | null;
  topReporters: AdminTopReporterDto[];
}

export interface AdminFailedLoginTargetDto {
  /** Email or username the failed attempts were made against. */
  identifier: string;
  failures: number;
}

/**
 * Header summary of the admin "Sécurité" page. Scoped to LOGIN_FAILED: the other
 * event types are deliberate account actions the log already reads well as a
 * list, whereas failed logins only mean something as a rate. The three windows
 * mirror the ones /admin/stats uses for account activity (24 h / 7 j / 30 j).
 */
export interface AdminSecuritySummaryDto {
  loginFailed24h: number;
  loginFailed7d: number;
  loginFailed30d: number;
  /** Every failed login ever logged. */
  loginFailedTotal: number;
  /** Most-targeted identifiers over the last 7 days, most failures first. */
  topTargets7d: AdminFailedLoginTargetDto[];
}

export interface AdminPushUserAgentStatDto {
  /** Browser family derived from the stored user-agent ("Chrome", "Safari", "Inconnu"…). */
  label: string;
  count: number;
}

/**
 * Header summary of the "Push" tab of admin "Communications". Active
 * subscriptions only, and deliberately no alive/dead ratio: a subscription the
 * push service rejects is deleted on the spot (see `PushService`), so a dead one
 * leaves no row to count.
 */
export interface AdminPushSummaryDto {
  /** Subscription rows on the instance (an account can have several devices). */
  subscriptions: number;
  /** Distinct accounts with at least one subscription. */
  accounts: number;
  /** Most devices first. */
  byUserAgent: AdminPushUserAgentStatDto[];
}
