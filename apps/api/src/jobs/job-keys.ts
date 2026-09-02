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

/** Display metadata for the admin "Jobs & tâches" page. */
export const JOB_REGISTRY: Record<JobKey, { label: string; schedule: string }> =
  {
    [JOB_KEYS.NOTIFICATIONS_SCAN]: {
      label: "Scan des notifications",
      schedule: "Toutes les heures",
    },
    [JOB_KEYS.NOTIFICATIONS_DIGEST]: {
      label: "Digest de notifications (sorties)",
      schedule:
        "Toutes les heures (envoi à l'heure locale de chaque utilisateur : quotidien 18h, hebdo lundi 9h)",
    },
    [JOB_KEYS.MEDIA_REFRESH_STALE]: {
      label: "Rafraîchissement du cache",
      schedule: "Toutes les 6 heures",
    },
    [JOB_KEYS.REPORTS_DIGEST]: {
      label: "Digest des signalements",
      schedule: "Tous les jours à 7h",
    },
    [JOB_KEYS.BACKUP]: {
      label: "Sauvegarde automatique",
      schedule: "Tous les jours à 3h",
    },
    [JOB_KEYS.INACTIVE_ACCOUNTS_SCAN]: {
      label: "Comptes inactifs (relance + suppression)",
      schedule: "Tous les jours à 5h",
    },
    [JOB_KEYS.GAMIFICATION_RECONCILE]: {
      label: "Réconciliation XP (contrôle d'intégrité)",
      schedule: "Tous les jours à 4h",
    },
    [JOB_KEYS.GAMIFICATION_ACHIEVEMENTS_SWEEP]: {
      label: "Balayage des succès (filet de sécurité)",
      schedule: "Tous les jours à 5h",
    },
  };
