import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { LibraryModule } from "../library/library.module";
import { CalendarFeedController } from "./calendar/calendar-feed.controller";
import { CalendarFeedService } from "./calendar/calendar-feed.service";
import { EeLicenseGuard } from "./licensing/ee-license.guard";
import { EeStatusController } from "./licensing/ee-status.controller";
import { LicenseService } from "./licensing/license.service";

/**
 * Everything under `ee/` is licensed under LICENSE-EE, not the AGPL. The
 * core never imports from here; app.module.ts is the one place that does.
 */
@Module({
  imports: [EntitlementModule, LibraryModule],
  controllers: [EeStatusController, CalendarFeedController],
  providers: [LicenseService, EeLicenseGuard, CalendarFeedService],
})
export class EeModule {}
