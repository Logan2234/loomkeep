/** Stable identifiers for the app's scheduled jobs, shared by their owning service and the admin registry. */
export const JOB_KEYS = {
  NOTIFICATIONS_SCAN: "notifications.scan",
  NOTIFICATIONS_DIGEST: "notifications.digest",
  MEDIA_REFRESH_STALE: "media.refreshStale",
  REPORTS_DIGEST: "reports.digest",
  BACKUP: "backup.run",
  INACTIVE_ACCOUNTS_SCAN: "users.inactiveAccountsScan",
  GAMIFICATION_RECONCILE: "gamification.reconcile",
  GAMIFICATION_ACHIEVEMENTS_SWEEP: "gamification.achievementsSweep",
} as const;

export type JobKey = (typeof JOB_KEYS)[keyof typeof JOB_KEYS];

/**
 * env var holding this job's Healthchecks.io ping URL (the base one, without
 * a "/fail" suffix). Unset/empty = pinging is disabled for that job — see
 * JobRunService.ping.
 */
export const JOB_HEALTHCHECK_ENV: Record<JobKey, string> = {
  [JOB_KEYS.NOTIFICATIONS_SCAN]: "HEALTHCHECKS_NOTIFICATIONS_SCAN_URL",
  [JOB_KEYS.NOTIFICATIONS_DIGEST]: "HEALTHCHECKS_NOTIFICATIONS_DIGEST_URL",
  [JOB_KEYS.MEDIA_REFRESH_STALE]: "HEALTHCHECKS_MEDIA_REFRESH_STALE_URL",
  [JOB_KEYS.REPORTS_DIGEST]: "HEALTHCHECKS_REPORTS_DIGEST_URL",
  [JOB_KEYS.BACKUP]: "HEALTHCHECKS_BACKUP_URL",
  [JOB_KEYS.INACTIVE_ACCOUNTS_SCAN]: "HEALTHCHECKS_INACTIVE_ACCOUNTS_SCAN_URL",
  [JOB_KEYS.GAMIFICATION_RECONCILE]: "HEALTHCHECKS_GAMIFICATION_RECONCILE_URL",
  [JOB_KEYS.GAMIFICATION_ACHIEVEMENTS_SWEEP]:
    "HEALTHCHECKS_GAMIFICATION_ACHIEVEMENTS_SWEEP_URL",
};
