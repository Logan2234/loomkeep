import { Global, Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { ProviderHttpService } from "./provider-http.service";
import { QuotaTrackerService } from "./quota-tracker.service";

// Global: every catalog provider, the importers and MailService count their
// upstream calls through it, and the providers call out through
// ProviderHttpService. Owns the ApiCallCounter table
// (prisma/schema/quota.prisma).
@Global()
@Module({
  imports: [MetricsModule],
  providers: [QuotaTrackerService, ProviderHttpService],
  exports: [QuotaTrackerService, ProviderHttpService],
})
export class QuotaModule {}
