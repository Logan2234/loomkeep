import { ErrorCode, type JobListResponseDto } from "@loomkeep/shared";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { MediaItemService } from "../catalog/media-item.service";
import { AppException } from "../common/app.exception";
import { AchievementService } from "../gamification/achievements/achievement.service";
import { XpService } from "../gamification/xp.service";
import { JOB_KEYS, type JobKey } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { NotificationDigestService } from "../notifications/notification-digest.service";
import { NotificationService } from "../notifications/notification.service";
import { ReportService } from "../reports/report.service";
import { InactiveAccountService } from "../users/inactive-account.service";
import { AdminOnly } from "./admin-only.decorator";
import { BackupService } from "./backup.service";
import { JobListResponseResponseDto } from "./dto/job-list-response.dto";

/** Narrows a raw path segment to a known job key, rather than trusting it as an index. */
function isJobKey(key: string): key is JobKey {
  return (Object.values(JOB_KEYS) as string[]).includes(key);
}

/** Scheduled jobs: run history and manual triggering. */
@AdminOnly()
@Controller("admin")
export class AdminJobsController {
  constructor(
    private readonly jobRuns: JobRunService,
    private readonly notifications: NotificationService,
    private readonly notificationDigests: NotificationDigestService,
    private readonly mediaItems: MediaItemService,
    private readonly reports: ReportService,
    private readonly backup: BackupService,
    private readonly inactiveAccount: InactiveAccountService,
    private readonly xp: XpService,
    private readonly achievements: AchievementService,
  ) {}

  /** Every known scheduled job, with its recent run history. */
  @Get("jobs")
  @ApiOkResponse({ type: JobListResponseResponseDto })
  async listJobs(): Promise<JobListResponseDto> {
    return { jobs: await this.jobRuns.listJobs() };
  }

  /**
   * What "Lancer maintenant" runs, one entry per {@link JOB_KEYS} member.
   *
   * Typed as a total Record rather than a switch: the admin page offers a
   * button for every key in the registry, so a key with no runner here is a
   * 404 the user meets at the worst possible moment. Three of them
   * (notification digests, XP reconciliation, achievements sweep) had been in
   * exactly that state. As a Record, adding a key to the registry without a
   * runner no longer compiles.
   */
  private get runners(): Record<JobKey, () => Promise<unknown>> {
    return {
      [JOB_KEYS.NOTIFICATIONS_SCAN]: () => this.notifications.scanAll(),
      [JOB_KEYS.NOTIFICATIONS_DIGEST]: () =>
        this.notificationDigests.runDigests(),
      [JOB_KEYS.MEDIA_REFRESH_STALE]: () => this.mediaItems.refreshStale(),
      [JOB_KEYS.REPORTS_DIGEST]: () => this.reports.sendDailyDigest(),
      [JOB_KEYS.BACKUP]: () => this.backup.runScheduled(),
      [JOB_KEYS.INACTIVE_ACCOUNTS_SCAN]: () => this.inactiveAccount.scan(),
      [JOB_KEYS.GAMIFICATION_RECONCILE]: () => this.xp.runReconcileJob(),
      [JOB_KEYS.GAMIFICATION_ACHIEVEMENTS_SWEEP]: () =>
        this.achievements.runAchievementsSweepJob(),
    };
  }

  /** Triggers a job immediately — every one of them is idempotent, so running it outside its cron tick is safe. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("jobs/:key/run")
  async runJob(@Param("key") key: string): Promise<void> {
    // Checked against the registry's own values before it ever indexes
    // `runners`. A plain truthiness test on the lookup wouldn't do: an
    // arbitrary path segment also reaches Object.prototype, so
    // `jobs/constructor/run` would find a callable and dispatch to it.
    if (!isJobKey(key)) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.AdminUnknownJob);
    }

    await this.runners[key]();
  }
}
