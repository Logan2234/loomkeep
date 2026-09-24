import { Module } from "@nestjs/common";
import { AccountSecurityEventsController } from "./account-security-events.controller";
import { CspReportController } from "./csp-report.controller";
import { CspReportService } from "./csp-report.service";
import { SecurityEventService } from "./security-event.service";

@Module({
  controllers: [AccountSecurityEventsController, CspReportController],
  providers: [SecurityEventService, CspReportService],
  exports: [SecurityEventService],
})
export class SecurityModule {}
