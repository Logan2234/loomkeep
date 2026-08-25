import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlements/entitlement.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { UsersModule } from "../users/users.module";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [ReviewsModule, UsersModule, EntitlementModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
