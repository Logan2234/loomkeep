import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import type { JobListResponseDto } from "@loomkeep/shared";
import { MediaItemService } from "../catalog/media-item.service";
import { JOB_KEYS, type JobKey } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { NotificationService } from "../notifications/notification.service";
import { ReportService } from "../reports/report.service";
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
      default:
        throw new NotFoundException("Unknown job");
    }
  }
}
