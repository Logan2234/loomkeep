// Instance-wide admin statistics, section by section ("Salle des machines").
//
// Deliberately split per section rather than one monolithic payload: each
// section has its own endpoint, its own refresh cadence and its own failure
// mode. It replaces the former `AdminStatsDto`/`AdminTrendsDto`, of which only
// the handful of counters the /admin dashboard and /admin/communications read
// survive, as `AdminOverviewDto` (dto/admin.ts).

import type { Locale, ProfileAccess, ReportCategory } from "../enums";
import type { TrendPeriod, TrendPointDto } from "./admin";
import type { RatingBucketDto, StatsDomain } from "./stats";

/* ── Comptes & engagement ─────────────────────────────────────────────── */

/** New-account curve for one bucket size — re-queried by the card's own period picker. */
export interface AdminNewAccountsTrendDto {
  period: TrendPeriod;
  points: TrendPointDto[];
  /** Accounts on the instance right now (all time, not just the window). */
  totalAccounts: number;
  /** New accounts in the most recent bucket. */
  delta: number;
}

/**
 * One signup-month cohort. `retention[i]` is the share (0-100) of the cohort
 * still active `i` calendar months after signing up; index 0 is the signup
 * month itself. The array is shorter for recent cohorts (no future months).
 */
export interface AdminCohortRowDto {
  /** UTC ISO date of the cohort month's first day. */
  month: string;
  /** Accounts created that month. */
  size: number;
  retention: number[];
}

/** How many accounts enabled exactly `domains` domains (out of the 6 that exist). */
export interface AdminEnabledDomainsBucketDto {
  domains: number;
  accounts: number;
}

interface AdminProfileAccessCountDto {
  access: ProfileAccess;
  count: number;
}

/** Raw engagement counters, no time window beyond the dormancy threshold. */
interface AdminAccountHealthDto {
  /** Accounts with a session used in the last 24 hours — feeds the KPI strip, not the health card. */
  active24h: number;
  /** Accounts with a session used in the last 30 days — same, KPI strip only. */
  active30d: number;
  /** No session used in the last DORMANT_AFTER_DAYS days (accounts that never signed in count as dormant). */
  dormant: number;
  /** Non-expired refresh tokens, i.e. live sessions across every account. */
  activeSessions: number;
  emailVerified: number;
  withPush: number;
  /** Opted into the release newsletter (User.notifyNewsletter). */
  withNewsletter: number;
  /** Opted into "new episode" email alerts (User.notifyEmail) — distinct from the newsletter. */
  withEpisodeEmail: number;
}

/** One age bracket in years, e.g. "25-34"; the last bracket ("65+") has no upper bound. */
export interface AdminAgeBucketDto {
  label: string;
  count: number;
}

interface AdminAgeStatsDto {
  /** Always the same brackets, zero-filled — only accounts with a birthDate are counted. */
  distribution: AdminAgeBucketDto[];
  /** Share (0-100) of all accounts with a birthDate set. */
  birthDateSetPercent: number;
  /** Share (0-100) of all accounts with 18+ content enabled. */
  adultContentPercent: number;
}

interface AdminLocaleCountDto {
  /** Paraglide locale code. */
  locale: Locale;
  count: number;
}

export interface AdminAccountsSectionDto {
  generatedAt: string;
  total: number;
  newAccounts: AdminNewAccountsTrendDto;
  /** Oldest cohort first — rows get shorter as they get more recent. */
  cohorts: AdminCohortRowDto[];
  /** Descending by account count. */
  byEnabledDomainCount: AdminEnabledDomainsBucketDto[];
  /** Descending by count. */
  byProfileAccess: AdminProfileAccessCountDto[];
  health: AdminAccountHealthDto;
  age: AdminAgeStatsDto;
  /** Descending by count. */
  byLocale: AdminLocaleCountDto[];
}

/* ── Catalogue & cache ────────────────────────────────────────────────── */

export interface AdminCacheDomainRowDto {
  domain: StatsDomain;
  /** Cached items for that domain. */
  items: number;
  /**
   * Share (0-100) of items past the 24h refresh TTL, or null when the domain
   * has no periodic refresh at all (games/books/music have no cron yet, so
   * "stale" would be meaningless there).
   */
  stalePercent: number | null;
  /** Cumulative item count over a fixed 12-week window. */
  growth: TrendPointDto[];
}

/** A cached work ranked by how many library entries reference it. */
export interface AdminPopularWorkDto {
  domain: StatsDomain;
  title: string;
  entries: number;
}

export interface AdminCatalogueSectionDto {
  generatedAt: string;
  byDomain: AdminCacheDomainRowDto[];
  /** Single mixed ranking across every domain, descending. */
  popular: AdminPopularWorkDto[];
  /** Share (0-100) of cached items referenced by at least 2 accounts, all domains. */
  sharedPercent: number;
  /** Cached items no library entry references, all domains. */
  orphanCount: number;
}

/* ── Social ───────────────────────────────────────────────────────────── */

/** Instance-wide social counters, all time. */
interface AdminSocialTotalsDto {
  reviews: number;
  /** Comments still standing (tombstones excluded). */
  comments: number;
  lists: number;
  /** Accepted follow edges only — pending requests aren't a relationship yet. */
  follows: number;
  reactions: number;
  /** ReviewVote rows with an UP value. */
  helpfulVotes: number;
  blocks: number;
  /**
   * Share (0-100) of all comments ever written that are now tombstones —
   * author self-deletion and admin takedown alike, they read the same to a
   * thread's readers.
   */
  deletedCommentPercent: number;
}

/**
 * Reviews + comments created per bucket — the one temporal series of the
 * section (the mockup only had static totals; a flat curve is what tells an
 * admin the social surface went quiet). Re-queried by the card's own picker.
 */
export interface AdminSocialActivityTrendDto {
  period: TrendPeriod;
  points: TrendPointDto[];
  /** Sum over the whole window. */
  total: number;
}

/** One report category ranked by volume, descending. */
export interface AdminReportCategoryCountDto {
  category: ReportCategory;
  count: number;
}

interface AdminReportsStatsDto {
  pending: number;
  resolved: number;
  /** Median `resolvedAt - createdAt` over closed reports, in hours; null when none are closed. */
  medianResolutionHours: number | null;
  /**
   * Share (0-100) of *closed* reports that were acted on (RESOLVED) rather
   * than dismissed. Pending reports are excluded — they have no verdict yet.
   * Null when nothing is closed.
   */
  foundedPercent: number | null;
  /**
   * Descending, every category with at least one report. Excludes reports
   * filed before the category/motif picker existed (`category: null`) — an
   * "unknown" bucket would just be noise on an instance old enough to have
   * pre-picker rows.
   */
  byCategory: AdminReportCategoryCountDto[];
}

/** One account ranked by how much it writes. */
export interface AdminTopContributorDto {
  username: string;
  /** Reviews + comments (tombstones excluded), all time. */
  contributions: number;
}

interface AdminInstanceRatingsDto {
  /** Always the 10 buckets, zero-filled. */
  distribution: RatingBucketDto[];
  average: number | null;
  /** Reviews behind the distribution. */
  total: number;
}

export interface AdminSocialStatsDto {
  generatedAt: string;
  totals: AdminSocialTotalsDto;
  activity: AdminSocialActivityTrendDto;
  reports: AdminReportsStatsDto;
  ratings: AdminInstanceRatingsDto;
  /** Descending, top few only. */
  topContributors: AdminTopContributorDto[];
  /** Accounts that ever posted a review or a comment. */
  contributors: number;
  /** Accounts that never did. `contributors + readers` is the account total. */
  readers: number;
}

/**
 * The section vanishes rather than 404s when SOCIAL_ENABLED is off: unlike a
 * social *route*, this is one block of an admin page that must keep rendering
 * its other sections, so the flag is data here, not a guard.
 */
export type AdminSocialSectionDto =
  { enabled: false } | ({ enabled: true } & AdminSocialStatsDto);

/* ── Système ──────────────────────────────────────────────────────────── */
// Database size / per-table breakdown deliberately lives outside the app now
// (Homepage dashboard, via Prometheus/postgres_exporter) — it's
// infrastructure monitoring, not Loomkeep business data, and doesn't need a
// query running on every /admin/stats load.

export interface AdminProviderCallsDto {
  /** Human label ("TMDB", "Open Library"…). */
  provider: string;
  /** Calls recorded today (UTC day). */
  calls: number;
  /** Documented free-tier daily quota, null when the provider publishes none. */
  dailyLimit: number | null;
  /** `calls` as a share (0-100) of `dailyLimit`; null without a limit. */
  percentUsed: number | null;
}

interface AdminBackupSummaryDto {
  createdAt: string;
  sizeBytes: number;
}

interface AdminOpsSignalsDto {
  /**
   * Notification rows currently outstanding. Reading one deletes it (see the
   * `Notification` model), so there's no read/unread split any more — a row's
   * existence already means "unread".
   */
  notificationsPending: number;
  /**
   * Push subscription rows. A total, not a live/dead split: nothing tracks
   * whether an endpoint still answers.
   */
  pushSubscriptions: number;
  /** SecurityEvent LOGIN_FAILED rows in the last 24 hours. */
  failedLogins24h: number;
  lastBackup: AdminBackupSummaryDto | null;
}

export interface AdminSystemSectionDto {
  generatedAt: string;
  /** Descending by calls. */
  providerCalls: AdminProviderCallsDto[];
  ops: AdminOpsSignalsDto;
}
