import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { AccountSecurityEventsController } from "./account-security-events.controller";
import { SecurityEventService } from "./security-event.service";

@Module({
  imports: [MailModule, JobsModule],
  controllers: [AccountSecurityEventsController],
  providers: [SecurityEventService],
  exports: [SecurityEventService],
})
export class SecurityModule {}
