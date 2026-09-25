import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { LibraryModule } from "../library/library.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { StatsModule } from "../stats/stats.module";
import { CalendarFeedController } from "./calendar/calendar-feed.controller";
import { CalendarFeedService } from "./calendar/calendar-feed.service";
import { EeLicenseGuard } from "./licensing/ee-license.guard";
import { EeStatusController } from "./licensing/ee-status.controller";
import { LicenseService } from "./licensing/license.service";
import { AdvancedStatsService } from "./stats/advanced-stats.service";

/**
 * Everything under `ee/` is licensed under LICENSE-EE, not the AGPL. The
 * core never imports from here; app.module.ts is the one place that does.
 */
@Module({
  imports: [EntitlementModule, LibraryModule, ReviewsModule, StatsModule],
  controllers: [EeStatusController, CalendarFeedController],
  providers: [
    LicenseService,
    EeLicenseGuard,
    CalendarFeedService,
    AdvancedStatsService,
  ],
})
export class EeModule {}
