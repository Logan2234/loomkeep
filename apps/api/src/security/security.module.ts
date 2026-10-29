import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { AccountSecurityEventsController } from "./account-security-events.controller";
import { SecurityEventService } from "./security-event.service";

@Module({
  imports: [MailModule],
  controllers: [AccountSecurityEventsController],
  providers: [SecurityEventService],
  exports: [SecurityEventService],
})
export class SecurityModule {}
