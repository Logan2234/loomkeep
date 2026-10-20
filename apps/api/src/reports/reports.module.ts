import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { AdminAlertModule } from "../notifications/admin-alert.module";
import { NotificationModule } from "../notifications/notification.module";
import { ModerationDecisionService } from "./moderation-decision.service";
import { ReportService } from "./report.service";
import { TransparencyController } from "./transparency.controller";
import { TransparencyService } from "./transparency.service";

// Report is a polymorphic target (comments, reviews, profiles, lists) shared
// across features — its only controller serves the public transparency
// figures; the Comments, Reviews, Social and Lists modules wire the filing
// endpoints, AdminModule wires the moderation queue. MailModule/JobsModule are
// needed for ReportService's daily digest cron; NotificationModule for the
// DSA art. 16(5) in-app resolution notice (ReportService — art. 16(4)'s
// receipt confirmation is just the caller's own success toast, no backend
// notice needed) and the art. 17 statement of reasons
// (ModerationDecisionService, email + in-app).
@Module({
  imports: [
    MailModule,
    JobsModule,
    NotificationModule,
    EventsModule,
    AdminAlertModule,
  ],
  controllers: [TransparencyController],
  providers: [ReportService, ModerationDecisionService, TransparencyService],
  exports: [ReportService, ModerationDecisionService],
})
export class ReportsModule {}
