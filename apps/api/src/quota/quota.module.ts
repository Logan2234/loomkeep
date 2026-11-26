import { Global, Module } from "@nestjs/common";
import { QuotaTrackerService } from "./quota-tracker.service";

// Global: every catalog provider, the importers and MailService count their
// upstream calls through it. Owns the ApiCallCounter table
// (prisma/schema/quota.prisma).
@Global()
@Module({
  providers: [QuotaTrackerService],
  exports: [QuotaTrackerService],
})
export class QuotaModule {}
