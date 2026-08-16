import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationModule } from "../notifications/notification.module";
import { ModerationDecisionService } from "./moderation-decision.service";
import { ReportService } from "./report.service";

// Report is a polymorphic target (COMMENT today, REVIEW/USER later) shared
// across features — no controller of its own; CommentsModule wires the filing
// endpoint, AdminModule wires the moderation queue. MailModule/JobsModule are
// needed for ReportService's daily digest cron; NotificationModule for
// ModerationDecisionService's DSA art. 17 notices (email + in-app).
@Module({
  imports: [MailModule, JobsModule, NotificationModule],
  providers: [ReportService, ModerationDecisionService],
  exports: [ReportService, ModerationDecisionService],
})
export class ReportsModule {}
