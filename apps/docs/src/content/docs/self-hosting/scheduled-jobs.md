---
title: Scheduled jobs
description: What runs on its own, when, and the variable to monitor each job with Healthchecks.io.
---

The API runs these jobs by itself: nothing to schedule on the server. Times
are the server's, UTC in the default images. **Admin › Jobs & tasks** shows
each job's recent runs and runs one by hand.

| Job                      | When          | What it does                                                                                                         | Healthchecks.io variable                           |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| New episodes             | Every hour    | Finds the episodes newly out for the shows people follow.                                                            | `HEALTHCHECKS_NOTIFICATIONS_SCAN_URL`              |
| Notification digests     | Every hour    | Sends each person's digest at their local time: 6 p.m. for the daily one, Monday 9 a.m. for the weekly one.          | `HEALTHCHECKS_NOTIFICATIONS_DIGEST_URL`            |
| Films and series refresh | Every 6 hours | Refreshes tracked titles not synced for a day, so new episodes are known before the hourly check.                    | `HEALTHCHECKS_MEDIA_REFRESH_STALE_URL`             |
| Games refresh            | Every 6 hours | The same for games.                                                                                                  | `HEALTHCHECKS_GAMES_REFRESH_STALE_URL`             |
| Books refresh            | Every 6 hours | The same for books.                                                                                                  | `HEALTHCHECKS_BOOKS_REFRESH_STALE_URL`             |
| Backup                   | 3 a.m.        | Dumps and encrypts the database, keeping the last seven: see [Backups](/self-hosting/upgrades-and-backups/#backups). | `HEALTHCHECKS_BACKUP_URL`                          |
| XP reconciliation        | 4 a.m.        | Removes experience points whose cause is gone (an episode unticked, a review deleted), then recounts totals.         | `HEALTHCHECKS_GAMIFICATION_RECONCILE_URL`          |
| Achievements sweep       | 5 a.m.        | Awards any achievement missed along the way, imports included.                                                       | `HEALTHCHECKS_GAMIFICATION_ACHIEVEMENTS_SWEEP_URL` |
| Inactive accounts        | 5 a.m.        | Warns accounts unused for 2 years by email, and deletes them after 3. Any sign-in cancels the warning.               | `HEALTHCHECKS_INACTIVE_ACCOUNTS_SCAN_URL`          |
| API keys                 | 6 a.m.        | Warns a week before a key expires, and deletes keys unused for a year.                                               | `HEALTHCHECKS_API_KEYS_MAINTENANCE_URL`            |
| Reports digest           | 7 a.m.        | Emails administrators the pending moderation reports, if there are any.                                              | `HEALTHCHECKS_REPORTS_DIGEST_URL`                  |
| Security log clean-up    | 6 a.m.        | Deletes security log entries older than a year.                                                                      | —                                                  |
| Invitations clean-up     | 6:30 a.m.     | Deletes invitations left unused for 30 days after they expired or were revoked.                                      | —                                                  |

To be alerted when a job stops running, see
[Monitoring](/self-hosting/optional-services/monitoring/#scheduled-jobs).

## Worth knowing

**Inactive accounts are deleted** three years after their last use, only
once a warning email has actually gone out. Without
[SMTP](/self-hosting/email-and-push/), no warning can be sent, so no account
is ever deleted for inactivity. A failed send is retried the next day.
