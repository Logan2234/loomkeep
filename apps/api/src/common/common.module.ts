import { Global, Module } from "@nestjs/common";
import { HibpService } from "./hibp.service";
import { QuotaTrackerService } from "./quota-tracker.service";

@Global()
@Module({
  providers: [QuotaTrackerService, HibpService],
  exports: [QuotaTrackerService, HibpService],
})
export class CommonModule {}
