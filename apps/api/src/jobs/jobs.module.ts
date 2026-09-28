import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { JobAlertService } from "./job-alert.service";
import { JobRunService } from "./job-run.service";

// PrismaService comes from the global PrismaModule.
@Module({
  imports: [MailModule],
  providers: [JobRunService, JobAlertService],
  exports: [JobRunService],
})
export class JobsModule {}
