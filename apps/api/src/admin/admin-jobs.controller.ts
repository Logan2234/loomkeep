import { ErrorCode, type JobListResponseDto } from "@loomkeep/shared";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { MediaItemService } from "../catalog/media-item.service";
import { AppException } from "../common/app.exception";
import { JOB_KEYS, type JobKey } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { NotificationService } from "../notifications/notification.service";
import { ReportService } from "../reports/report.service";
import { InactiveAccountService } from "../users/inactive-account.service";
import { AdminOnly } from "./admin-only.decorator";
import { BackupService } from "./backup.service";

/** Scheduled jobs: run history and manual triggering. */
@AdminOnly()
@Controller("admin")
export class AdminJobsController {
  constructor(
    private readonly jobRuns: JobRunService,
    private readonly notifications: NotificationService,
    private readonly mediaItems: MediaItemService,
    private readonly reports: ReportService,
    private readonly backup: BackupService,
    private readonly inactiveAccount: InactiveAccountService,
  ) {}

  /** Every known scheduled job, with its recent run history. */
  @Get("jobs")
  async listJobs(): Promise<JobListResponseDto> {
    return { jobs: await this.jobRuns.listJobs() };
  }

  /** Triggers a job immediately (both are idempotent — safe outside its cron tick). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("jobs/:key/run")
  async runJob(@Param("key") key: string): Promise<void> {
    switch (key as JobKey) {
      case JOB_KEYS.NOTIFICATIONS_SCAN:
        await this.notifications.scanAll();
        return;
      case JOB_KEYS.MEDIA_REFRESH_STALE:
        await this.mediaItems.refreshStale();
        return;
      case JOB_KEYS.REPORTS_DIGEST:
        await this.reports.sendDailyDigest();
        return;
      case JOB_KEYS.BACKUP:
        await this.backup.runScheduled();
        return;
      case JOB_KEYS.INACTIVE_ACCOUNTS_SCAN:
        await this.inactiveAccount.scan();
        return;
      default:
        throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.AdminUnknownJob);
    }
  }
}
